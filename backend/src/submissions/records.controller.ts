import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
  NotFoundException,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { RecordsService } from './records.service';
import { PdfRendererService } from './pdf-renderer.service';
import { BulkPdfService } from './bulk-pdf.service';
import { FormsService } from '../forms/forms.service';
import { FilesService } from '../files/files.service';
import { interpolatePdfTemplate } from './pdf-interpolator';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionType,
  AdminActionTargetType,
} from '../admin-audit/admin-action.entity';

interface AuthRequest {
  user: { id: number; email?: string; name?: string; role: string };
  ip?: string;
}

/** Helper para extraer el actor del request JWT (mismo criterio que forms.controller / users.controller). */
function actorFrom(req: AuthRequest): { id: number; name: string; role: string } {
  return {
    id: Number(req.user.id),
    name: req.user.name ?? req.user.email ?? `user#${req.user.id}`,
    role: req.user.role,
  };
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RecordsController {
  private readonly logger = new Logger(RecordsController.name);

  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly recordsService: RecordsService,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly auditService: AdminAuditService,
    private readonly bulkPdf: BulkPdfService,
  ) {}

  @Get('forms/:formId/records')
  @RequirePermission(Permission.REPORTS_VIEW)
  async list(
    @Param('formId') formId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') search?: string,
  ) {
    return this.recordsService.listByForm(formId, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(200, Math.max(1, parseInt(limit, 10) || 50)),
      from,
      to,
      search,
    });
  }

  @Get('submissions/:id/pdf')
  @RequirePermission(Permission.REPORTS_VIEW)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const sub = await this.submissionModel
      .findById(id)
      .select('templateSnapshot pdfFilename data formId submittedAt')
      .lean();
    if (!sub) throw new NotFoundException('Registro no encontrado');
    if (!sub.templateSnapshot) {
      throw new NotFoundException(
        'Este registro no tiene PDF disponible (fue enviado antes de habilitarse esta función).',
      );
    }

    const form = await this.formsService.findOne(sub.formId);

    const html = await interpolatePdfTemplate({
      template: sub.templateSnapshot,
      data: sub.data as Record<string, unknown>,
      widgets: (form.schema as { widgets?: Array<{ id: string; type: string; label?: string }> }).widgets ?? [],
      filesService: this.filesService,
    });
    const buffer = await this.pdfRenderer.htmlToPdfBuffer(html);
    const filename =
      sub.pdfFilename ??
      `registro_${sub.formId}_${sub.submittedAt.toISOString().slice(0, 10)}.pdf`;

    // El endpoint sirve tanto el preview (modal) como el "descargar" real —
    // el server no sabe distinguirlos, y el modal PDF ya cuenta como "ver".
    // Emitimos SUBMISSION_PDF_VIEWED (honesto), y el frontend usa el mismo
    // buffer del preview para el download sin pegar de nuevo al backend.
    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.SUBMISSION_PDF_VIEWED,
      targetType: AdminActionTargetType.SUBMISSION,
      targetId: id,
      targetName: form.name,
      metadata: { formId: sub.formId, ip: req.ip ?? null },
    });

    // RFC 5987 filename*=UTF-8''<pct-encoded> protege contra CRLF injection
    // aunque el DTO ya valide pdfFilename con regex estricta — defensa en
    // profundidad para envios historicos con nombres viejos sin validar.
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    );
    res.send(buffer);
  }

  @Post('forms/:formId/records/bulk-pdf')
  @RequirePermission(Permission.REPORTS_VIEW)
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @HttpCode(202)
  async requestBulk(
    @Param('formId') formId: string,
    @Body() body: { from?: string; to?: string; q?: string },
    @Request() req: AuthRequest,
  ): Promise<{ ok: true; message: string }> {
    // Fire-and-forget: renderizar cientos de PDFs con Puppeteer puede tomar
    // minutos y revienta cualquier proxy con timeout HTTP default. Devolvemos
    // 202 Accepted de inmediato; el usuario recibe el resultado por correo.
    const filters = body ?? {};
    const ip = req.ip ?? null;
    const actor = {
      name: req.user.email ?? `user${req.user.id}`,
      role: req.user.role,
    };
    const userId = req.user.id;

    void this.bulkPdf
      .request(formId, userId, filters, ip, actor)
      .then((result) => {
        if (result.ok) {
          this.logger.log(
            `[bulk-pdf] user=${userId} form=${formId} ok count=${result.count}`,
          );
        } else {
          this.logger.warn(
            `[bulk-pdf] user=${userId} form=${formId} sin_resultado: ${result.message}`,
          );
        }
      })
      .catch((err) => {
        this.logger.error(
          `[bulk-pdf] user=${userId} form=${formId} ERROR: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });

    return {
      ok: true,
      message:
        'Estamos generando y enviándote los PDFs por correo. Esto puede tomar unos minutos; revisa tu bandeja cuando termine.',
    };
  }
}
