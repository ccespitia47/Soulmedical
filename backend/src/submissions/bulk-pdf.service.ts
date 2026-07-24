import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { FilesService } from '../files/files.service';
import { PdfRendererService } from './pdf-renderer.service';
import { UsersService } from '../users/users.service';
import { SecureDownloadsService } from '../reports/secure-downloads.service';
import { EmailService } from '../email/email.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminActionType, AdminActionTargetType } from '../admin-audit/admin-action.entity';
import { interpolatePdfTemplate } from './pdf-interpolator';
import { encryptedZip } from './zip-crypto';

const MAX_PDFS = 500;
const RENDER_CONCURRENCY = 3;
const TTL_MINUTES = 2;

export async function renderInBatches<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    try {
      out[i] = await worker(items[i], i);
    } catch {
      out[i] = null;
    }
    await next();
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return out;
}

@Injectable()
export class BulkPdfService {
  private readonly logger = new Logger(BulkPdfService.name);

  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly usersService: UsersService,
    private readonly secureDownloads: SecureDownloadsService,
    private readonly emailService: EmailService,
    private readonly audit: AdminAuditService,
  ) {}

  async request(
    formId: string,
    userId: number,
    filters: { from?: string; to?: string; q?: string },
    ip: string | null,
    actor: { name: string; role: string },
  ): Promise<{ ok: boolean; count: number; message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.documentNumber) {
      throw new ForbiddenException(
        'Debes configurar tu número de documento en tu perfil antes de descargar PDFs masivos (será la contraseña del ZIP).',
      );
    }

    // FormsService.findOne ya lanza NotFoundException si no existe / está inactivo.
    const form = await this.formsService.findOne(formId);

    // Query submissions con snapshot
    const query: Record<string, unknown> = {
      formId,
      templateSnapshot: { $ne: null },
    };
    if (filters.from || filters.to) {
      const range: Record<string, Date> = {};
      if (filters.from) range.$gte = new Date(filters.from);
      if (filters.to) range.$lte = new Date(filters.to + 'T23:59:59.999Z');
      query.submittedAt = range;
    }

    let subs = (await this.submissionModel
      .find(query)
      .select('templateSnapshot pdfFilename data formId submittedAt')
      .sort({ submittedAt: -1 })
      .limit(MAX_PDFS)
      .lean()) as unknown as Array<any>;

    if (filters.q?.trim()) {
      const needle = filters.q.toLowerCase();
      subs = subs.filter((s) =>
        Object.values(s.data ?? {}).some((v) => String(v ?? '').toLowerCase().includes(needle)),
      );
    }

    if (subs.length === 0) {
      return {
        ok: false,
        count: 0,
        message: 'No hay registros con PDF disponible en el filtro seleccionado.',
      };
    }

    this.logger.log(`[bulkPdf] Generando ${subs.length} PDFs para "${form.name}"`);

    const widgets = (form.schema as any).widgets ?? [];
    const rendered = await renderInBatches(subs, RENDER_CONCURRENCY, async (sub) => {
      const html = await interpolatePdfTemplate({
        template: sub.templateSnapshot,
        data: sub.data,
        widgets,
        filesService: this.filesService,
      });
      const buffer = await this.pdfRenderer.htmlToPdfBuffer(html);
      const name =
        sub.pdfFilename ??
        `registro_${new Date(sub.submittedAt).toISOString().slice(0, 10)}_${sub._id}.pdf`;
      return { name, buffer };
    });

    const files = rendered.filter((r): r is { name: string; buffer: Buffer } => r != null);
    if (files.length === 0) {
      await this.audit.log({
        actor: { id: userId, name: actor.name, role: actor.role },
        action: AdminActionType.SUBMISSIONS_BULK_PDF_FAILED,
        targetType: AdminActionTargetType.FORM,
        targetId: formId,
        targetName: form.name,
        metadata: { attempted: subs.length, ip },
      });
      return { ok: false, count: 0, message: 'Ningún PDF se pudo generar. Contacta a soporte.' };
    }

    const zipBuffer = await encryptedZip(files, user.documentNumber);
    const filename = `PDFs_${sanitizeFilename(form.name)}_${new Date().toISOString().slice(0, 10)}.zip`;

    const { token, expiresAt } = await this.secureDownloads.create({
      userId,
      kind: 'bulk-pdf',
      formId,
      formName: form.name,
      encryptedBuffer: zipBuffer,
      filename,
      ttlMinutes: TTL_MINUTES,
      createdIp: ip,
    });

    await this.audit.log({
      actor: { id: userId, name: actor.name, role: actor.role },
      action: AdminActionType.SUBMISSIONS_BULK_PDF_REQUESTED,
      targetType: AdminActionTargetType.FORM,
      targetId: formId,
      targetName: form.name,
      metadata: {
        count: files.length,
        filtered: subs.length - files.length,
        tokenId: token,
        expiresAt,
        ip,
      },
    });

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const downloadUrl = `${appBaseUrl.replace(/\/$/, '')}/reports/download/${token}`;

    await this.emailService.sendReportLink({
      to: user.email,
      userName: user.name,
      formName: form.name,
      url: downloadUrl,
      expiresInMinutes: TTL_MINUTES,
      kind: 'bulk-pdf',
      count: files.length,
    });

    return {
      ok: true,
      count: files.length,
      message: `Se enviaron ${files.length} PDF(s) a ${user.email}. Revisa tu correo.`,
    };
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'formulario';
}
