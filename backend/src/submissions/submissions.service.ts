import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilesService } from '../files/files.service';
import { PdfRendererService } from './pdf-renderer.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

const BINARY_WIDGET_TYPES = new Set(['signature', 'photo']);
const GRIDFS_PREFIX = 'gridfs:';

export interface SubmissionsPage {
  data: FormSubmissionDocument[];
  total: number;
  page: number;
  limit: number;
}

export interface ExportRow {
  id: string;
  submittedAt: Date;
  submittedById: number | null;
  [field: string]: unknown;
}

export interface ExportPage {
  data: ExportRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  async submit(
    formId: string,
    dto: CreateSubmissionDto,
    userId?: number,
  ): Promise<FormSubmissionDocument> {
    const form = await this.formsService.findOne(formId);
    const data = await this.offloadBinaries(form, dto.data, userId ?? null);

    const submission = new this.submissionModel({
      formId,
      formVersion: form.version,
      data,
      metadata: dto.metadata ?? null,
      submittedById: userId ?? null,
      templateSnapshot: dto.templateSnapshot ?? null,
      pdfFilename: dto.pdfFilename ?? null,
    });
    return submission.save();
  }

  private async offloadBinaries(
    form: { schema: Record<string, unknown> },
    data: Record<string, unknown>,
    submittedById: number | null,
  ): Promise<Record<string, unknown>> {
    const schema = form.schema as {
      widgets?: Array<{ id: string; type: string }>;
    };
    const binaryWidgets = new Map<string, string>();
    for (const w of schema.widgets ?? []) {
      if (BINARY_WIDGET_TYPES.has(w.type)) binaryWidgets.set(w.id, w.type);
    }
    if (binaryWidgets.size === 0) return data;

    const formId = (form as { _id?: string })._id ?? '';
    const out: Record<string, unknown> = { ...data };
    for (const [widgetId, kind] of binaryWidgets) {
      const value = out[widgetId];
      if (typeof value !== 'string' || !value.startsWith('data:')) continue;
      const fileId = await this.filesService.uploadDataUrl(value, {
        kind: kind as 'signature' | 'photo',
        formId,
        widgetId,
        submittedById,
      });
      if (fileId) out[widgetId] = `${GRIDFS_PREFIX}${fileId}`;
    }
    return out;
  }

  async findByForm(
    formId: string,
    page = 1,
    limit = 50,
    from?: string,
    to?: string,
  ): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { formId };
    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter['$gte'] = new Date(from);
      if (to) dateFilter['$lte'] = new Date(to + 'T23:59:59.999Z');
      query['submittedAt'] = dateFilter;
    }
    const [data, total] = await Promise.all([
      this.submissionModel
        .find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-templateSnapshot'), // no enviamos el snapshot en la lista
      this.submissionModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id);
    if (!submission)
      throw new NotFoundException(`Respuesta ${id} no encontrada`);
    return submission;
  }

  async findAll(page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.submissionModel
        .find()
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-templateSnapshot'),
      this.submissionModel.countDocuments(),
    ]);
    return { data, total, page, limit };
  }

  async findByUser(
    userId: number,
    page = 1,
    limit = 50,
  ): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const query = { submittedById: userId };
    const [data, total] = await Promise.all([
      this.submissionModel
        .find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-templateSnapshot'),
      this.submissionModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async countByForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({ formId });
  }

  // ── PDF individual ────────────────────────────────────────────────────────

  async getHtmlSnapshot(id: string): Promise<{ html: string | null; pdfFilename: string | null }> {
    const sub = await this.submissionModel.findById(id).select('templateSnapshot pdfFilename');
    if (!sub) throw new NotFoundException(`Respuesta ${id} no encontrada`);
    return { html: sub.templateSnapshot ?? null, pdfFilename: sub.pdfFilename ?? null };
  }

  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const sub = await this.submissionModel.findById(id).select('templateSnapshot pdfFilename formId submittedAt');
    if (!sub) throw new NotFoundException(`Respuesta ${id} no encontrada`);

    if (!sub.templateSnapshot) {
      throw new NotFoundException(
        'Este registro no tiene snapshot de PDF. Solo los registros enviados después de activar esta función tienen PDF disponible.',
      );
    }

    const buffer = await this.pdfRenderer.htmlToPdfBuffer(sub.templateSnapshot);
    const filename =
      sub.pdfFilename ??
      `registro_${sub.formId}_${sub.submittedAt.toISOString().slice(0, 10)}.pdf`;

    return { buffer, filename };
  }

  // ── Descarga masiva por correo ─────────────────────────────────────────────

  async bulkPdfEmail(
    formId: string,
    userId: number,
    from?: string,
    to?: string,
  ): Promise<{ success: boolean; message: string; count: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const form = await this.formsService.findOne(formId);

    // Buscar todas las submissions con snapshot en el rango de fechas
    const query: Record<string, unknown> = {
      formId,
      templateSnapshot: { $ne: null },
    };
    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter['$gte'] = new Date(from);
      if (to) dateFilter['$lte'] = new Date(to + 'T23:59:59.999Z');
      query['submittedAt'] = dateFilter;
    }

    const submissions = await this.submissionModel
      .find(query)
      .select('templateSnapshot pdfFilename formId submittedAt')
      .sort({ submittedAt: -1 })
      .limit(500); // máximo 500 PDFs por envío

    if (submissions.length === 0) {
      return {
        success: false,
        message: 'No hay registros con PDF disponible en el período seleccionado.',
        count: 0,
      };
    }

    // Generar PDFs y empacar en ZIP
    this.logger.log(
      `[bulkPdf] Generando ${submissions.length} PDFs para formulario "${form.name}"`,
    );

    const zipBuffer = await this.buildZip(submissions);

    // Enviar por correo como adjunto
    const period = from && to
      ? `${from} al ${to}`
      : from
      ? `desde ${from}`
      : to
      ? `hasta ${to}`
      : 'todos los registros';

    await this.emailService.sendEmail({
      subject: `📦 PDFs de "${form.name}" — ${period}`,
      emailBody: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#00c2a8;">Descarga masiva de PDFs</h2>
          <p>Se adjuntan <strong>${submissions.length} PDF(s)</strong> del formulario
          <strong>${form.name}</strong> correspondientes al período: ${period}.</p>
          <p style="color:#6b7280;font-size:13px;">
            Cada PDF corresponde a un registro enviado y refleja el formato
            exacto del formulario en el momento del envío.
          </p>
        </div>
      `,
      toRecipients: [{ type: 'static', email: user.email }],
      senderName: 'SoulForms',
      attachments: [
        {
          name: `PDFs_${this.sanitize(form.name)}_${this.timestamp()}.zip`,
          contentType: 'application/zip',
          contentBytes: zipBuffer.toString('base64'),
        },
      ],
    });

    return {
      success: true,
      message: `Se enviaron ${submissions.length} PDF(s) a ${user.email}. Revisa tu correo.`,
      count: submissions.length,
    };
  }

  private async buildZip(
    submissions: FormSubmissionDocument[],
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();
      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', reject);
      archive.pipe(passThrough);

      for (const sub of submissions) {
        if (!sub.templateSnapshot) continue;
        try {
          const pdfBuffer = await this.pdfRenderer.htmlToPdfBuffer(
            sub.templateSnapshot,
          );
          const filename =
            sub.pdfFilename ??
            `registro_${sub.submittedAt.toISOString().slice(0, 10)}_${sub.id}.pdf`;
          archive.append(pdfBuffer, { name: filename });
        } catch (err) {
          this.logger.warn(
            `[bulkPdf] Error generando PDF para submission ${sub.id}: ${err}`,
          );
        }
      }

      await archive.finalize();
    });
  }

  // ── Export para Power BI ──────────────────────────────────────────────────

  async exportByForm(
    formId: string,
    page = 0,
    limit = 100,
    from?: string,
    to?: string,
  ): Promise<ExportPage> {
    const form = await this.formsService.findOneForExport(formId);
    const EXCLUDED_TYPES = new Set(['header', 'html_block']);

    type SubField = { id: string; label?: string };
    interface WidgetMeta {
      label: string;
      type: string;
      fieldLabels?: Map<string, string>;
    }
    const schema = form.schema as {
      widgets?: Array<{
        id: string;
        type: string;
        label?: string;
        config?: { fields?: SubField[] };
      }>;
    };
    const widgetMap = new Map<string, WidgetMeta>();
    for (const w of schema.widgets ?? []) {
      const meta: WidgetMeta = { label: w.label ?? w.id, type: w.type };
      if (w.type === 'subform') {
        const fieldLabels = new Map<string, string>();
        for (const f of w.config?.fields ?? []) {
          fieldLabels.set(f.id, f.label ?? f.id);
        }
        meta.fieldLabels = fieldLabels;
      }
      widgetMap.set(w.id, meta);
    }

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter['$gte'] = new Date(from);
    if (to) dateFilter['$lte'] = new Date(to + 'T23:59:59.999Z');

    const query: Record<string, unknown> = { formId };
    if (from || to) query['submittedAt'] = dateFilter;

    const skip = page * limit;
    const [submissions, total] = await Promise.all([
      this.submissionModel
        .find(query as any)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-templateSnapshot'),
      this.submissionModel.countDocuments(query as any),
    ]);

    const data: ExportRow[] = submissions.map((sub) => {
      const row: ExportRow = {
        id: sub.id as string,
        submittedAt: sub.submittedAt,
        submittedById: sub.submittedById,
      };

      const rawData = (sub.data ?? {}) as Record<string, unknown>;
      for (const [widgetId, value] of Object.entries(rawData)) {
        const widget = widgetMap.get(widgetId);
        if (!widget) continue;
        const label = widget.label;
        const type = widget.type;
        if (EXCLUDED_TYPES.has(type)) continue;

        if (type === 'signature' || type === 'photo') {
          if (typeof value === 'string' && value.startsWith(GRIDFS_PREFIX)) {
            const fileId = value.slice(GRIDFS_PREFIX.length);
            const base = process.env.PUBLIC_BASE_URL ?? '';
            row[label] = `${base}/api/submissions/files/${fileId}`;
          } else {
            row[label] = value;
          }
          continue;
        }

        if (type === 'id_scanner' && value && typeof value === 'object' && !Array.isArray(value)) {
          const doc = value as Record<string, string>;
          row[`${label} - Nombre`] = doc.nombre ?? '';
          row[`${label} - Número`] = doc.numero ?? '';
          row[`${label} - Fecha Nacimiento`] = doc.fechaNacimiento ?? '';
        } else if (type === 'subform') {
          const fieldLabels = widget?.fieldLabels;
          const entries = Array.isArray(value) ? value : [];
          row[label] = entries.map((entry) => {
            const labeled: Record<string, unknown> = {};
            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
              for (const [fieldId, fieldValue] of Object.entries(
                entry as Record<string, unknown>,
              )) {
                const fieldLabel = fieldLabels?.get(fieldId) ?? fieldId;
                let out: unknown = fieldValue;
                if (typeof fieldValue === 'string' && fieldValue.startsWith('[')) {
                  try {
                    const arr = JSON.parse(fieldValue);
                    if (Array.isArray(arr)) out = arr.join(', ');
                  } catch { /* dejar como string */ }
                }
                labeled[fieldLabel] = out;
              }
            }
            return labeled;
          });
        } else {
          row[label] = value;
        }
      }

      return row;
    });

    return { data, total, page, limit };
  }

  private sanitize(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'formulario';
  }

  private timestamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}