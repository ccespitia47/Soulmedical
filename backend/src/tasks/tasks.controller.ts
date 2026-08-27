import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { TasksService } from './tasks.service';
import { CreateTaskDto, SubmitTaskStepDto } from './tasks.dto';
import type { TaskSummaryPageDto } from './tasks-list.dto';
import type { TaskDocument } from './task.schema';
import { BulkPdfService } from '../submissions/bulk-pdf.service';

type AuthedRequest = Request & {
  user?: { id: number; email?: string; role?: string };
};

@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly bulkPdf: BulkPdfService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: AuthedRequest) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');

    const dto: CreateTaskDto = {
      formId: body.formId as string,
      folderId: body.folderId as string,
      formName: body.formName as string,
      title: body.title as string,
      description: body.description as string | undefined,
      prefilledData: (body.prefilledData as Record<string, string>) || {},
      steps: (body.steps as CreateTaskDto['steps']) || [],
      widgets: (body.widgets as Record<string, unknown>[]) || [],
      rules: (body.rules as Record<string, unknown>[]) || [],
      emailTemplate:
        (body.emailTemplate as Record<string, unknown> | null | undefined) ??
        null,
      generateShareLink: body.generateShareLink === true,
      oneShotLink: body.oneShotLink === true,
    };

    const task = await this.tasksService.create(
      dto,
      Number(user.id),
      user.email || 'Admin',
    );

    // Usamos APP_BASE_URL (la variable estandar del backend, ver
    // auth.service, reports.service, bulk-pdf.service, tasks.service).
    // PUBLIC_BASE_URL no existe en produccion: si quedaba, shareLinkUrl salia
    // como "/tasks/share/<token>" (relativo) y al pegarlo en WhatsApp el link
    // estaba roto.
    const baseUrl = process.env.APP_BASE_URL ?? '';
    const shareLinkUrl = task.shareLink?.token
      ? `${baseUrl}/t/${task.shareLink.token}`
      : null;

    // toObject() para exponer las propiedades del schema. El spread sobre un
    // documento Mongoose crudo devuelve solo símbolos internos y el frontend
    // no ve _id (rompe "Respuesta sin id de tarea" en CreateTaskModal).
    const taskDoc = task as unknown as TaskDocument;
    return { ...taskDoc.toObject(), shareLinkUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('formId') formId?: string,
  ) {
    return this.tasksService.findAll({ status, formId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-tasks')
  async findMyPending(@Req() req: AuthedRequest) {
    const user = req.user;
    if (!user?.email) throw new UnauthorizedException('Usuario sin email');
    return this.tasksService.findMyPending(user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // ── Reportes de tarea (pestaña "Reportes" en Records) ──────────────────────
  // Registrado en TasksController (no en FormsController) con path
  // 'by-form/:formId' para no chocar con el ':id' de arriba (segmentos
  // distintos: /tasks/by-form/x tiene 2 segmentos, /tasks/:id tiene 1).

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.REPORTS_VIEW)
  @Get('by-form/:formId')
  async listByForm(
    @Param('formId') formId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<TaskSummaryPageDto> {
    return this.tasksService.listByForm(formId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.REPORTS_VIEW)
  @Get(':id/detail')
  async getDetail(@Param('id') id: string) {
    return this.tasksService.getDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/steps/:stepIndex/resend')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30/min por IP (safety net; la lógica per-step gobierna el throttle real)
  async resendStep(
    @Param('id') id: string,
    @Param('stepIndex', ParseIntPipe) stepIndex: number,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    return this.tasksService.resendStep(id, stepIndex, Number(user.id));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.REPORTS_VIEW)
  @Post(':id/bulk-pdf')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @HttpCode(202)
  async bulkPdfForTask(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<{ ok: true; message: string }> {
    const task = await this.tasksService.findOne(id);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    const userId = Number(user.id);
    const actor = { name: user.email ?? `user${user.id}`, role: user.role ?? '' };

    // Fire-and-forget: renderizar PDFs con Puppeteer puede tomar minutos y
    // revienta cualquier proxy con timeout HTTP default (mismo patrón que
    // RecordsController.requestBulk). El usuario recibe el resultado por correo.
    void this.bulkPdf
      .request(task.formId, userId, { taskId: id }, req.ip ?? null, actor)
      .then((result) => {
        if (result.ok) {
          this.logger.log(`[bulk-pdf] task=${id} user=${userId} ok count=${result.count}`);
        } else {
          this.logger.warn(
            `[bulk-pdf] task=${id} user=${userId} sin_resultado: ${result.message}`,
          );
        }
      })
      .catch((err) => {
        this.logger.error(
          `[bulk-pdf] task=${id} user=${userId} ERROR: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });

    return {
      ok: true,
      message: 'Estamos generando y enviándote los PDFs por correo.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() req: AuthedRequest) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    return this.tasksService.cancel(id, Number(user.id), user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/send')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async sendTask(
    @Param('id') id: string,
    @Body() body: { steps?: Array<{ recipientEmail: string; recipientName?: string }> },
    @Req() req: AuthedRequest,
  ): Promise<{ ok: true; sentCount: number }> {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    const steps = Array.isArray(body?.steps) ? body.steps : [];
    return this.tasksService.sendTask(id, steps, Number(user.id));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/share-link')
  async toggleShareLink(
    @Param('id') id: string,
    @Body() body: { enabled: boolean; oneShot?: boolean },
    @Req() req: AuthedRequest,
  ) {
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuario no autenticado');
    return this.tasksService.toggleShareLink(
      id,
      body.enabled === true,
      Number(user.id),
      body.oneShot,
    );
  }

  @Get('public/:token')
  async getByToken(@Param('token') token: string) {
    const { task, stepIndex } = await this.tasksService.getByToken(token);
    const step = task.steps[stepIndex];
    const taskWithId = task as typeof task & { _id?: string; id?: string };
    const isLastStep = stepIndex === task.steps.length - 1;
    return {
      taskId: taskWithId._id || taskWithId.id,
      title: task.title,
      description: task.description,
      formName: task.formName,
      widgets: task.widgets,
      rules: task.rules ?? [],
      prefilledData: task.prefilledData,
      stepIndex,
      totalSteps: task.steps.length,
      stepOrder: step.order,
      recipientName: step.recipientName,
      recipientEmail: step.recipientEmail,
      // Solo enviamos el template al último paso: el cliente genera el PDF
      // y lo manda como attachment al submit. Pasos intermedios no lo necesitan.
      emailTemplate: isLastStep ? task.emailTemplate ?? null : null,
      // Datos acumulados de los pasos previos para que el PDF del último
      // paso incluya todo el historial.
      previousStepsData: this.tasksService.collectPreviousStepsData(
        task,
        stepIndex,
      ),
    };
  }

  @Post('public/:token/submit')
  async submitStep(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const dto: SubmitTaskStepDto = {
      formData: (body.formData as Record<string, string>) || {},
      attachments:
        (body.attachments as SubmitTaskStepDto['attachments']) || undefined,
    };
    const forwarded = req.headers['x-forwarded-for'];
    const ip = req.ip ?? (Array.isArray(forwarded) ? forwarded[0] : forwarded);
    return this.tasksService.submitStep(token, dto, ip);
  }

  @Get('share/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getShareByToken(@Param('token') token: string) {
    return this.tasksService.findByShareToken(token);
  }

  // Búsqueda pública (sin auth) para widgets "search" con fuente
  // form_submissions dentro de un formulario compartido por enlace. El widget
  // se resuelve por id dentro de la tarea del token (no se acepta un formId
  // arbitrario del cliente). Rate-limit como el GET del share.
  @Post('share/:token/search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async searchShare(
    @Param('token') token: string,
    @Body() body: { widgetId?: string; q?: string },
  ) {
    return this.tasksService.searchFromShare(
      token,
      body?.widgetId ?? '',
      body?.q ?? '',
    );
  }

  @Post('share/:token/submit')
  // 10/min por IP: baja el techo de DoS de GridFS. Con body limit global
  // (50MB) y firmas/photos grandes, 30/min = ~1.5GB/min por IP. 10 es
  // suficiente para uso legitimo (WhatsApp -> llenar -> enviar).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async submitShare(
    @Param('token') token: string,
    @Body() body: { data?: Record<string, unknown> },
  ) {
    if (!body?.data || typeof body.data !== 'object') {
      throw new BadRequestException('Falta el campo data');
    }
    const { submissionId } = await this.tasksService.submitFromShare(
      token,
      body.data,
    );
    return { ok: true, submissionId };
  }
}