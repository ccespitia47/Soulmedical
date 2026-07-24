import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

@Injectable()
export class SecureDownloadsService {
  // Cast to `any` to avoid Mongoose's strict `string & ObjectId` generic
  // conflicts when querying by a plain string _id (UUID).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any;

  constructor(
    @InjectModel(SecureDownload.name)
    model: Model<SecureDownloadDocument>,
  ) {
    this.db = model;
  }

  async create(
    input: CreateSecureDownloadInput,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    const doc: SecureDownloadDocument = await this.db.create({
      userId: input.userId,
      kind: input.kind,
      formId: input.formId,
      formName: input.formName,
      encryptedBuffer: input.encryptedBuffer,
      filename: input.filename,
      expiresAt,
      consumed: false,
      totpAttempts: 0,
      createdIp: input.createdIp ?? null,
    });
    return { token: doc._id as string, expiresAt };
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
   */
  async consume(
    token: string,
    userId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
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
    return { buffer: doc.encryptedBuffer, filename: doc.filename };
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
}
