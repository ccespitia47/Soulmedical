import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilesService } from '../files/files.service';

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
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly filesService: FilesService,
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

  async countByForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({ formId });
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
}