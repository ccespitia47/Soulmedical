import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument } from './form-submission.schema';
import { FormsService } from '../forms/forms.service';
import { UsersService } from '../users/users.service';

export type RecordRow = {
  id: string;
  submittedAt: Date;
  userName: string;
  summary: Record<string, string>;
  hasPdf: boolean;
};

export type RecordsPage = {
  data: RecordRow[];
  total: number;
  page: number;
  limit: number;
};

// Widgets cuyo valor NO se resume en la tabla (no aportan como columna).
const SUMMARY_SKIP = new Set(['header', 'html_block', 'signature', 'photo']);
// Máximo de columnas resumen a devolver (además de Fecha y Usuario).
const MAX_SUMMARY_COLS = 4;

@Injectable()
export class RecordsService {
  constructor(
    @InjectModel(FormSubmission.name)
    private readonly submissionModel: Model<FormSubmissionDocument>,
    private readonly formsService: FormsService,
    private readonly usersService: UsersService,
  ) {}

  async listByForm(
    formId: string,
    opts: { page: number; limit: number; from?: string; to?: string; search?: string },
  ): Promise<RecordsPage> {
    const form = await this.formsService.findOne(formId);
    if (!form) throw new NotFoundException(`Formulario ${formId} no encontrado`);

    // Preparar mapa widgetId → label solo para las primeras N columnas útiles.
    const widgets = ((form.schema as { widgets?: Array<{ id: string; type: string; label?: string }> }).widgets ?? [])
      .filter((w) => w.label && !SUMMARY_SKIP.has(w.type))
      .slice(0, MAX_SUMMARY_COLS);

    const query: Record<string, unknown> = { formId };
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to + 'T23:59:59.999Z');
      query.submittedAt = range;
    }
    if (opts.search && opts.search.trim()) {
      // Búsqueda simple: cualquier valor del data.* contiene el texto.
      // Mongo no permite $regex sobre valores mixtos → usamos $text si el
      // formulario tiene índice de texto; si no, filtramos post-fetch.
      // Por simplicidad y como los formularios son pequeños (<10k), filtramos
      // aquí en memoria después de traer la página.
    }

    const skip = (opts.page - 1) * opts.limit;
    const [docs, total] = await Promise.all([
      this.submissionModel
        .find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(opts.limit)
        .lean() as unknown as Promise<Array<FormSubmissionDocument & { data: Record<string, unknown> }>>,
      this.submissionModel.countDocuments(query),
    ]);

    // Filtro por texto post-fetch (simple)
    const needle = opts.search?.trim().toLowerCase() ?? '';
    const filtered = needle
      ? docs.filter((d) =>
          Object.values(d.data ?? {}).some((v) =>
            String(v ?? '').toLowerCase().includes(needle),
          ),
        )
      : docs;

    const userIds = Array.from(new Set(filtered.map((d) => (d as any).submittedById).filter(Boolean))) as number[];
    const userMap = await this.usersService.findByIds(userIds);

    const data: RecordRow[] = filtered.map((d) => {
      const summary: Record<string, string> = {};
      for (const w of widgets) {
        const raw = d.data?.[w.id];
        summary[w.label ?? w.id] = raw == null ? '' : String(raw);
      }
      const uid = (d as any).submittedById as number | null;
      return {
        id: String((d as any)._id),
        submittedAt: d.submittedAt,
        userName: uid && userMap[uid] ? userMap[uid].name : '—',
        summary,
        hasPdf: !!(d as any).templateSnapshot,
      };
    });

    return { data, total, page: opts.page, limit: opts.limit };
  }
}
