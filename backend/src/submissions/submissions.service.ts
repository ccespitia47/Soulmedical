import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FilesService } from '../files/files.service';
import { generateExcelTemplateHtml, type ExcelFieldMapping } from './excel-template';

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
    // taskId NUNCA viene del cliente (mismo criterio que templateSnapshot):
    // solo tasks.service.ts lo pasa, derivado del token de tarea validado
    // server-side. Aceptarlo del DTO permitiría a cualquiera "adoptar" su
    // submission dentro de una tarea ajena.
    taskId?: string,
  ): Promise<FormSubmissionDocument> {
    const form = await this.formsService.findOne(formId);
    const data = await this.offloadBinaries(form, dto.data, userId ?? null);

    // templateSnapshot se DERIVA del form (fuente de verdad) — nunca del
    // cliente. Aceptarlo del body permitía inyectar HTML/JS arbitrario que
    // después corría en Puppeteer (--no-sandbox) al generar el PDF: SSRF,
    // exfiltración, RCE potencial. Ver DTO para justificación completa.
    const emailTemplate = form.emailTemplate as
      | {
          attachPDF?: boolean;
          pdfTemplate?: string;
          excelBase64?: string;
          excelMappings?: ExcelFieldMapping[];
          excelLogoBase64?: string;
        }
      | null;
    // El formato del PDF se define de DOS maneras: (a) plantilla HTML
    // (pdfTemplate con ${placeholders}) o (b) Excel subido + mapeo de campos.
    // Para (b) generamos aquí, server-side, el HTML del Excel dejando los
    // ${placeholders} en las celdas mapeadas — el interpolador los llena al
    // renderizar (igual que la vía HTML). Antes solo (a) funcionaba en el
    // reporte; por eso los formatos definidos por Excel salían "sin PDF".
    let templateSnapshot: string | null = null;
    if (emailTemplate?.attachPDF && emailTemplate?.pdfTemplate?.trim()) {
      templateSnapshot = emailTemplate.pdfTemplate;
    } else if (
      emailTemplate?.excelBase64 &&
      (emailTemplate?.excelMappings?.length ?? 0) > 0
    ) {
      templateSnapshot = generateExcelTemplateHtml(
        emailTemplate.excelBase64,
        emailTemplate.excelMappings!,
        emailTemplate.excelLogoBase64,
      );
    }

    const submission = new this.submissionModel({
      formId,
      formVersion: form.version,
      data,
      metadata: dto.metadata ?? null,
      submittedById: userId ?? null,
      templateSnapshot,
      pdfFilename: dto.pdfFilename ?? null,
      taskId: taskId ?? null,
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
  ): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    // deletedAt: null → excluye los eliminados por soft delete. Se aplica
    // en todas las queries de listado (findByForm, findByUser, findAll,
    // findByTaskId, countByForm, exportByForm, searchSubmissions) para
    // que un registro "eliminado" desaparezca de vistas, reportes y
    // exports por igual.
    const query: Record<string, unknown> = { formId, deletedAt: null };
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

  async findByUser(
    userId: number,
    page = 1,
    limit = 50,
  ): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const query = { submittedById: userId, deletedAt: null };
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

  /**
   * Submissions ligadas a una Tarea (flujo de enlace compartible). A
   * diferencia de findByForm/findAll, SÍ incluye templateSnapshot: es
   * necesario para derivar el flag hasPdf en TaskSubmissionDto (Task 2 del
   * plan de tareas). El volumen esperado es bajo (submissions de una sola
   * tarea, no de todo el formulario), así que el costo es aceptable.
   */
  async findByTaskId(taskId: string): Promise<FormSubmissionDocument[]> {
    return this.submissionModel
      .find({ taskId, deletedAt: null })
      .sort({ submittedAt: -1 });
  }

  async findOne(id: string): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id);
    if (!submission)
      throw new NotFoundException(`Respuesta ${id} no encontrada`);
    return submission;
  }

  async findAll(page = 1, limit = 50): Promise<SubmissionsPage> {
    const skip = (page - 1) * limit;
    const filter = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.submissionModel
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-templateSnapshot'),
      this.submissionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async countByForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({ formId, deletedAt: null });
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
    // Widgets puramente visuales — no aportan datos de usuario y no deben
    // aparecer como columnas en Power BI.
    const EXCLUDED_TYPES = new Set(['header', 'html_block', 'image']);
    // Widgets que persisten su valor como referencia GridFS (prefijo
    // `gridfs:<fileId>`). Para Power BI los convertimos a URL pública así
    // el reporte puede embebemer la imagen/descargar el archivo directo.
    const GRIDFS_TYPES = new Set(['signature', 'photo', 'file', 'video']);

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

    const query: Record<string, unknown> = { formId, deletedAt: null };
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

        if (GRIDFS_TYPES.has(type)) {
          if (typeof value === 'string' && value.startsWith(GRIDFS_PREFIX)) {
            const fileId = value.slice(GRIDFS_PREFIX.length);
            // Usamos APP_BASE_URL: PUBLIC_BASE_URL no esta definida en
            // ningun deployment, por lo que las URLs de firmas/photos
            // exportadas salian relativas y rotas en el CSV.
            const base = process.env.APP_BASE_URL ?? '';
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
          // Default: valores escalares (text, number, email, phone, date, etc.)
          // van tal cual. Pero widgets multi-valor (checkbox, select multi,
          // radio multi, quiz_question multi) persisten como arreglo nativo o
          // como JSON array string: en Power BI eso se ve feo (celda con el
          // JSON crudo). Lo aplanamos a "A, B, C" para que la columna sea
          // legible y filtrable como texto.
          if (Array.isArray(value)) {
            row[label] = value.map((v) => String(v)).join(', ');
          } else if (
            typeof value === 'string' &&
            value.startsWith('[') &&
            value.endsWith(']')
          ) {
            try {
              const parsed: unknown = JSON.parse(value);
              row[label] = Array.isArray(parsed)
                ? parsed.map((v) => String(v)).join(', ')
                : value;
            } catch {
              row[label] = value;
            }
          } else {
            row[label] = value;
          }
        }
      }

      return row;
    });

    return { data, total, page, limit };
  }
  /**
   * Búsqueda de submissions por formulario para el widget "search" (autocomplete
   * de un formulario en otro). Escapa el input del usuario antes de usarlo como
   * regex (regex injection), limita el resultado a 50 filas máx, y devuelve
   * SOLO los objetos `data` — nunca metadata interna (_id, submittedById, etc.)
   * que no debería viajar a un widget de otro formulario.
   */
  async searchSubmissions(
    formId: string,
    q: string,
    fieldIds: string[],
    limit = 20,
  ): Promise<{ results: Record<string, unknown>[] }> {
    const query = q.trim();
    const cappedLimit = Math.min(50, Math.max(1, limit || 20));

    // Con q vacío: devolver los últimos N sin filtrar. Sirve como preview
    // inicial del modal del widget Search — el usuario ve datos listos para
    // seleccionar sin tener que escribir.
    if (!query) {
      const submissions = await this.submissionModel
        .find({ formId, deletedAt: null })
        .sort({ submittedAt: -1 })
        .limit(cappedLimit)
        .lean();
      return {
        results: submissions.map((s) => (s.data ?? {}) as Record<string, unknown>),
      };
    }

    // Escapa caracteres especiales de regex para que el input del usuario se
    // trate como texto literal, no como patrón (regex injection / ReDoS).
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (fieldIds.length > 0) {
      // Filtro a nivel Mongo: $or sobre cada campo buscable declarado en la
      // config del widget (data.<widgetId> regex, case-insensitive).
      const mongoQuery = {
        formId,
        deletedAt: null,
        $or: fieldIds.map((wid) => ({
          [`data.${wid}`]: { $regex: escapedQuery, $options: 'i' },
        })),
      };
      const submissions = await this.submissionModel
        .find(mongoQuery)
        .sort({ submittedAt: -1 })
        .limit(cappedLimit)
        .select('-templateSnapshot');

      return {
        results: submissions.map((sub) => ({ ...(sub.data ?? {}) })),
      };
    }

    // Sin campos declarados: el schema no tiene índice de texto ($text), así
    // que hacemos un filtro simple en memoria sobre la representación en
    // string de `data`, acotado a un máximo de documentos candidatos para no
    // escanear toda la colección del formulario.
    const regex = new RegExp(escapedQuery, 'i');
    const candidates = await this.submissionModel
      .find({ formId, deletedAt: null })
      .sort({ submittedAt: -1 })
      .limit(200)
      .select('-templateSnapshot');

    const results: Record<string, unknown>[] = [];
    for (const sub of candidates) {
      const data = (sub.data ?? {}) as Record<string, unknown>;
      const asString = Object.values(data)
        .map((v) => String(v ?? ''))
        .join(' ␟ ');
      if (regex.test(asString)) {
        results.push({ ...data });
        if (results.length >= cappedLimit) break;
      }
    }
    return { results };
  }
}