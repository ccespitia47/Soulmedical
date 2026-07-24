import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
  NotFoundException,
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
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly recordsService: RecordsService,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly auditService: AdminAuditService,
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

    await this.auditService.log({
      actor: actorFrom(req),
      action: AdminActionType.SUBMISSION_PDF_DOWNLOADED,
      targetType: AdminActionTargetType.SUBMISSION,
      targetId: id,
      targetName: form.name,
      metadata: { formId: sub.formId, ip: req.ip ?? null },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }
}
