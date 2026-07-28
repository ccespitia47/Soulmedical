import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FilesService } from '../files/files.service';
import {
  SecureDownload,
  SecureDownloadDocument,
  SecureDownloadKind,
} from './secure-download.schema';

export type CreateSecureDownloadInput = {
  userId: number;
  kind: SecureDownloadKind;
  formId: string;
  formName: string;
  encryptedBuffer: Buffer;
  filename: string;
  ttlMinutes: number;
  createdIp?: string | null;
};

export const MAX_TOTP_ATTEMPTS = 3;

const CONTENT_TYPE_BY_KIND: Record<SecureDownloadKind, string> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'bulk-pdf': 'application/zip',
};

@Injectable()
export class SecureDownloadsService {
  private readonly logger = new Logger(SecureDownloadsService.name);

  // Cast to `any` to avoid Mongoose's strict `string & ObjectId` generic
  // conflicts when querying by a plain string _id (UUID).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any;

  constructor(
    @InjectModel(SecureDownload.name)
    model: Model<SecureDownloadDocument>,
    private readonly filesService: FilesService,
  ) {
    this.db = model;
  }

  async create(
    input: CreateSecureDownloadInput,
  ): Promise<{ token: string; expiresAt: Date }> {
    // El buffer se guarda en GridFS (no inline en el doc Mongo) para
    // aguantar ZIPs de 50 MB — el doc BSON tiene tope duro de 16 MB.
    const contentType = CONTENT_TYPE_BY_KIND[input.kind];
    const encryptedFileId = await this.filesService.uploadBuffer(
      input.encryptedBuffer,
      input.filename,
      contentType,
      {
        secureDownload: true,
        kind: input.kind,
        userId: input.userId,
        formId: input.formId,
      },
    );

    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    try {
      const doc: SecureDownloadDocument = await this.db.create({
        userId: input.userId,
        kind: input.kind,
        formId: input.formId,
        formName: input.formName,
        encryptedFileId,
        filename: input.filename,
        expiresAt,
        consumed: false,
        totpAttempts: 0,
        createdIp: input.createdIp ?? null,
      });
      return { token: doc._id as string, expiresAt };
    } catch (err) {
      // Si el doc no se pudo insertar, no dejar el blob huérfano en GridFS.
      await this.filesService.delete(encryptedFileId).catch(() => undefined);
      throw err;
    }
  }

  /**
   * Metadata sin exponer el buffer. Usada por la pantalla de verificación
   * 2FA para armar la UI. Fallamos con 404 en TODOS los casos negativos
   * para no revelar si el token existe (defensa contra enumeración).
   */
  async getMeta(
    token: string,
    userId: number,
  ): Promise<{
    formName: string;
    expiresAt: Date;
    totpAttempts: number;
    kind: SecureDownloadKind;
  }> {
    const doc: SecureDownloadDocument | null = await this.db.findOne({
      _id: token,
      userId,
      consumed: false,
      expiresAt: { $gt: new Date() },
    });
    if (!doc) throw new NotFoundException('Enlace no válido');
    return {
      formName: doc.formName,
      expiresAt: doc.expiresAt,
      totpAttempts: doc.totpAttempts,
      kind: doc.kind,
    };
  }

  /**
   * Consumo atómico: findOneAndUpdate garantiza que solo un request gana
   * la carrera si llegan dos simultáneamente. Si otro usuario intenta
   * consumir el token de alguien más → 403 (revela que existe, pero requerir
   * autenticación previa lo mitiga; el `consumed` NO se toca por eso).
   *
   * Post-consume borra el blob de GridFS best-effort para no acumular
   * archivos huérfanos entre expiraciones y limpieza manual.
   */
  async consume(
    token: string,
    userId: number,
  ): Promise<{ buffer: Buffer; filename: string; kind: SecureDownloadKind }> {
    // Verifica ownership primero para dar 403 explícito.
    const preview: SecureDownloadDocument | null = await this.db.findOne({ _id: token });
    if (preview && preview.userId !== userId) {
      throw new ForbiddenException('Enlace no válido');
    }
    const doc: SecureDownloadDocument | null = await this.db.findOneAndUpdate(
      {
        _id: token,
        userId,
        consumed: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumed: true, consumedAt: new Date() } },
    );
    if (!doc) throw new GoneException('Enlace expirado o ya usado');

    const { buffer } = await this.filesService.download(doc.encryptedFileId);
    // Blob ya entregado en RAM → borramos GridFS de inmediato.
    this.filesService
      .delete(doc.encryptedFileId)
      .catch((err) =>
        this.logger.warn(
          `[secure-downloads] fallo al borrar GridFS ${doc.encryptedFileId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    return { buffer, filename: doc.filename, kind: doc.kind };
  }

  /**
   * Incrementa el contador de intentos TOTP atómicamente. Al llegar a 3
   * intentos, marca el token como consumed=true para prevenir fuerza bruta
   * del código TOTP.
   *
   * Usa `findOneAndUpdate` con `{ new: true }` para obtener el valor
   * post-increment atómicamente — evita la race condition entre updateOne
   * y findOne separados que existía antes.
   */
  async incrementTotpAttempts(token: string, userId: number): Promise<number> {
    const updated: SecureDownloadDocument | null = await this.db.findOneAndUpdate(
      { _id: token, userId, consumed: false },
      { $inc: { totpAttempts: 1 } },
      { new: true },
    );
    if (!updated) return 0; // no existe, no es del user, o ya está consumed
    const attempts: number = updated.totpAttempts ?? 0;
    if (attempts >= MAX_TOTP_ATTEMPTS) {
      // Otro `findOneAndUpdate` con filtro consumed:false previene doble-write
      // si dos requests concurrentes llegan al 3er intento a la vez.
      await this.db.findOneAndUpdate(
        { _id: token, userId, consumed: false },
        { $set: { consumed: true, consumedAt: new Date() } },
      );
    }
    return attempts;
  }

  /**
   * Limpia GridFS de blobs cuyos documentos SecureDownload ya no existen
   * (típicamente porque el TTL de Mongo los borró antes de que el usuario
   * consumiera el link). Se puede llamar desde un cron o manualmente.
   * Retorna el número de blobs borrados.
   */
  async cleanupExpired(): Promise<number> {
    // Se leen los fileIds vigentes y se comparan contra GridFS. Como no
    // hay listado directo del bucket aquí, este método es un stub honesto:
    // los blobs quedan en el bucket hasta que un job externo los limpie.
    // El caso feliz (usuario consume) ya limpia inline; sólo expiraciones
    // sin consumo dejan huérfanos.
    this.logger.warn(
      '[secure-downloads] cleanupExpired() no implementado — los blobs GridFS de tokens expirados sin consumo requieren limpieza manual',
    );
    return 0;
  }
}
