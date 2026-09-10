import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FilesService } from '../files/files.service';
import { UsersService } from '../users/users.service';
import { ConsentValidationService } from './consent-validation.service';
import { consentHash } from './consent-hash';
import { CreateConsentDto } from './dto/create-consent.dto';
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
      apellidos: dto.apellidos,
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
}
