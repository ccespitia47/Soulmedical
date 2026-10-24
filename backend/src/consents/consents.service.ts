import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FilesService } from '../files/files.service';
import { UsersService } from '../users/users.service';
import { ConsentValidationService } from './consent-validation.service';
import { consentHash } from './consent-hash';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { PacienteLookupDto, VacunaPreviaDto } from './dto/paciente-lookup.dto';
import {
  ConsentRecord,
  ConsentRecordDocument,
  EstadoConsentimiento,
} from './consent-record.schema';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectModel(ConsentRecord.name)
    private readonly model: Model<ConsentRecordDocument>,
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
    private readonly validation: ConsentValidationService,
  ) {}

  /** Normaliza un doc .lean() (o plano) a la misma forma que produce el
   *  `toJSON` del schema: agrega `id`, conserva `_id` y descarta `__v`. */
  private toView(doc: any): any {
    const { __v, ...rest } = doc;
    return { ...rest, id: doc._id };
  }

  /** Sube un data URL a GridFS y devuelve 'gridfs:<id>'. Si ya es una
   *  referencia gridfs o está vacío, lo devuelve tal cual. */
  private async persistBinario(
    value: string | undefined | null,
    tipo: string,
    widgetId: string,
    kind: 'signature' | 'photo',
    userId: number | null,
  ): Promise<string | null> {
    if (!value) return null;
    if (value.startsWith('gridfs:')) return value;
    const id = await this.filesService.uploadDataUrl(value, {
      kind,
      formId: `consent:${tipo}`,
      widgetId,
      submittedById: userId,
    });
    return id ? `gridfs:${id}` : null;
  }

  async create(dto: CreateConsentDto, userId: number | null): Promise<ConsentRecord> {
    this.validation.validate({ tipo: dto.tipo, entidad: dto.entidad });

    const firmaPaciente = await this.persistBinario(
      dto.firmaPaciente, dto.tipo, 'firma_paciente', 'signature', userId,
    );
    const firmaResponsable = await this.persistBinario(
      dto.firmaResponsable, dto.tipo, 'firma_responsable', 'signature', userId,
    );
    const foto = await this.persistBinario(
      dto.foto, dto.tipo, 'foto', 'photo', userId,
    );

    const base = {
      tipo: dto.tipo,
      entidad: dto.entidad ?? null,
      tipoDoc: dto.tipoDoc,
      numDoc: dto.numDoc,
      nombres: dto.nombres,
      apellidos: dto.apellidos ?? null,
      ciudad: dto.ciudad ?? null,
      profesional: dto.profesional ?? null,
      respuestas: dto.respuestas,
      firmaPaciente,
      firmaResponsable,
      foto,
    };

    const hashVerificacion = consentHash(base as unknown as Record<string, unknown>);

    return this.model.create({
      ...base,
      estado: EstadoConsentimiento.FIRMADO,
      hashVerificacion,
      createdById: userId,
      createdAt: new Date(),
    });
  }

  async list(opts: {
    page: number; limit: number; tipo?: string; search?: string; from?: string; to?: string;
  }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};
    if (opts.tipo) query.tipo = opts.tipo;
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to + 'T23:59:59.999Z');
      query.createdAt = range;
    }
    if (opts.search && opts.search.trim()) {
      const rx = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ numDoc: rx }, { nombres: rx }, { apellidos: rx }];
    }

    const skip = (opts.page - 1) * opts.limit;
    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(opts.limit).lean(),
      this.model.countDocuments(query),
    ]);

    const ids = [...new Set(docs.map((d: any) => d.createdById).filter((x): x is number => x != null))];
    const users = ids.length ? await this.usersService.findByIds(ids) : {};

    const data = docs.map((d: any) => ({
      ...this.toView(d),
      creadoPor: d.createdById != null ? users[d.createdById]?.name ?? null : null,
    }));

    return { data, total, page: opts.page, limit: opts.limit };
  }

  /** Último consentimiento no anulado de una persona (numDoc exacto) y las
   *  vacunas previas aplanadas desde la Sección C de todos sus registros. */
  async lookupPaciente(numDoc: string, entidad: string | null): Promise<PacienteLookupDto> {
    const query: Record<string, unknown> = {
      numDoc: String(numDoc ?? '').trim(),
      entidad: entidad ?? null,
      estado: { $ne: 'anulado' },
    };
    const docs = (await this.model
      .find(query)
      .sort({ createdAt: -1 })
      .lean()) as any[];

    const vacunas: VacunaPreviaDto[] = [];
    for (const d of docs) {
      const raw = d.respuestas?.seccionC;
      let filas: unknown;
      try {
        filas = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        continue;
      }
      if (!Array.isArray(filas)) continue;
      const created = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '';
      const aplicada = String(d.respuestas?.fecha || created);
      for (const f of filas) {
        if (!f || typeof f !== 'object') continue;
        vacunas.push({
          vacuna: String((f as any).nombre ?? ''),
          dosis: String((f as any).dosis ?? ''),
          aplicada,
          proxima: String((f as any).proxima ?? ''),
        });
      }
    }
    return { ultimo: docs.length ? this.toView(docs[0]) : null, vacunas };
  }

  async findOne(id: string): Promise<ConsentRecord> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    return this.toView(doc);
  }

  async update(id: string, dto: UpdateConsentDto, userId: number | null): Promise<ConsentRecord> {
    const current = (await this.model.findById(id).lean()) as any;
    if (!current) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    if (dto.tipo || dto.entidad) {
      this.validation.validate({
        tipo: dto.tipo ?? current.tipo,
        entidad: (dto.entidad ?? current.entidad) ?? undefined,
      });
    }

    const tipo = dto.tipo ?? current.tipo;
    const firmaPaciente = dto.firmaPaciente
      ? await this.persistBinario(dto.firmaPaciente, tipo, 'firma_paciente', 'signature', userId)
      : current.firmaPaciente;
    const firmaResponsable = dto.firmaResponsable
      ? await this.persistBinario(dto.firmaResponsable, tipo, 'firma_responsable', 'signature', userId)
      : current.firmaResponsable;
    const foto = dto.foto
      ? await this.persistBinario(dto.foto, tipo, 'foto', 'photo', userId)
      : current.foto;

    const base = {
      tipo,
      entidad: (dto.entidad ?? current.entidad) ?? null,
      tipoDoc: dto.tipoDoc ?? current.tipoDoc,
      numDoc: dto.numDoc ?? current.numDoc,
      nombres: dto.nombres ?? current.nombres,
      apellidos: dto.apellidos ?? current.apellidos,
      ciudad: (dto.ciudad ?? current.ciudad) ?? null,
      profesional: (dto.profesional ?? current.profesional) ?? null,
      respuestas: dto.respuestas ?? current.respuestas,
      firmaPaciente, firmaResponsable, foto,
    };
    const hashVerificacion = consentHash(base as unknown as Record<string, unknown>);

    const updated = await this.model
      .findByIdAndUpdate(id, { ...base, hashVerificacion, updatedAt: new Date() }, { new: true })
      .lean();
    return this.toView(updated as any);
  }

  async anular(id: string): Promise<ConsentRecord> {
    const updated = await this.model
      .findByIdAndUpdate(id, { estado: EstadoConsentimiento.ANULADO }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    return this.toView(updated as any);
  }

  async pdfPayload(id: string): Promise<{
    record: ConsentRecord;
    firmaPacienteDataUrl: string | null;
    firmaResponsableDataUrl: string | null;
    fotoDataUrl: string | null;
  }> {
    const record = (await this.findOne(id)) as any;
    const [firmaPacienteDataUrl, firmaResponsableDataUrl, fotoDataUrl] = await Promise.all([
      record.firmaPaciente ? this.filesService.readAsDataUrl(record.firmaPaciente) : Promise.resolve(null),
      record.firmaResponsable ? this.filesService.readAsDataUrl(record.firmaResponsable) : Promise.resolve(null),
      record.foto ? this.filesService.readAsDataUrl(record.foto) : Promise.resolve(null),
    ]);
    return { record, firmaPacienteDataUrl, firmaResponsableDataUrl, fotoDataUrl };
  }

  async verificar(id: string): Promise<{ valido: boolean; hash: string }> {
    const d = (await this.model.findById(id).lean()) as any;
    if (!d) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    const base = {
      tipo: d.tipo, entidad: d.entidad ?? null, tipoDoc: d.tipoDoc, numDoc: d.numDoc,
      nombres: d.nombres, apellidos: d.apellidos, ciudad: d.ciudad ?? null,
      profesional: d.profesional ?? null, respuestas: d.respuestas,
      firmaPaciente: d.firmaPaciente ?? null, firmaResponsable: d.firmaResponsable ?? null,
      foto: d.foto ?? null,
    };
    const hash = consentHash(base as unknown as Record<string, unknown>);
    return { valido: hash === d.hashVerificacion, hash };
  }
}
