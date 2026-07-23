import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto, SubmitTaskStepDto } from './tasks.dto';

type AuthedRequest = Request & {
  user?: { id: number; email?: string; role?: string };
};

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
    };

    return this.tasksService.create(
      dto,
      Number(user.id),
      user.email || 'Admin',
    );
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.tasksService.cancel(id);
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
}