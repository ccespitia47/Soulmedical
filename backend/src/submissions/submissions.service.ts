import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

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
    @InjectModel(FormSubmission.name) private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
  ) {}

  async submit(formId: string, dto: CreateSubmissionDto, userId?: number): Promise<FormSubmissionDocument> {
    const form = await this.formsService.findOne(formId);
    const submission = new this.submissionModel({
      formId,
      formVersion: form.version,
      data: dto.data,
      metadata: dto.metadata ?? null,
      submittedById: userId ?? null,
    });
    return submission.save();
  }

  async findByForm(formId: string, page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.submissionModel.find({ formId }).sort({ submittedAt: -1 }).skip(skip).limit(limit),
      this.submissionModel.countDocuments({ formId }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id);
    if (!submission) throw new NotFoundException(`Respuesta ${id} no encontrada`);
    return submission;
  }

  async findAll(page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.submissionModel.find().sort({ submittedAt: -1 }).skip(skip).limit(limit),
      this.submissionModel.countDocuments(),
    ]);
    return { data, total, page, limit };
  }

  async countByForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({ formId });
  }

  // Endpoint para Power BI / herramientas externas: devuelve labels legibles y filtro por fecha
  async exportByForm(
    formId: string,
    page = 0,
    limit = 100,
    from?: string,
    to?: string,
  ): Promise<ExportPage> {
    const form = await this.formsService.findOne(formId);

    // Construir mapa widgetId → label desde el schema del formulario
    const schema = form.schema as { widgets?: Array<{ id: string; type: string; label?: string }> };
    const widgetMap = new Map<string, { label: string; type: string }>();
    for (const w of schema.widgets ?? []) {
      widgetMap.set(w.id, { label: w.label ?? w.id, type: w.type });
    }

    // Filtro por fecha
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter['$gte'] = new Date(from);
    if (to) dateFilter['$lte'] = new Date(to + 'T23:59:59.999Z');

    const query: Record<string, unknown> = { formId };
    if (from || to) query['submittedAt'] = dateFilter;

    const skip = page * limit;
    const [submissions, total] = await Promise.all([
      this.submissionModel.find(query as any).sort({ submittedAt: -1 }).skip(skip).limit(limit),
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
        const label = widget?.label ?? widgetId;
        const type = widget?.type ?? '';

        // id_scanner guarda { nombre, numero, fechaNacimiento } — aplanar en 3 columnas
        if (type === 'id_scanner' && value && typeof value === 'object' && !Array.isArray(value)) {
          const doc = value as Record<string, string>;
          row[`${label} - Nombre`] = doc.nombre ?? '';
          row[`${label} - Número`] = doc.numero ?? '';
          row[`${label} - Fecha Nacimiento`] = doc.fechaNacimiento ?? '';
        } else {
          row[label] = value;
        }
      }

      return row;
    });

    return { data, total, page, limit };
  }
}
