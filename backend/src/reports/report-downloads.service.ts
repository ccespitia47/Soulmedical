import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportDownload, ReportDownloadDocument } from './report-download.schema';

export type CreateReportDownloadInput = {
  userId: number;
  formId: string;
  formName: string;
  encryptedBuffer: Buffer;
  filename: string;
  ttlMinutes: number;
  createdIp?: string | null;
};

export const MAX_TOTP_ATTEMPTS = 3;

@Injectable()
export class ReportDownloadsService {
  // Cast to `any` to avoid Mongoose's strict `string & ObjectId` generic
  // conflicts when querying by a plain string _id (UUID).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any;

  constructor(
    @InjectModel(ReportDownload.name)
    model: Model<ReportDownloadDocument>,
  ) {
    this.db = model;
  }

  async create(
    input: CreateReportDownloadInput,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);
    const doc: ReportDownloadDocument = await this.db.create({
      userId: input.userId,
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
  ): Promise<{ formName: string; expiresAt: Date; totpAttempts: number }> {
    const doc: ReportDownloadDocument | null = await this.db.findOne({
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
    const preview: ReportDownloadDocument | null = await this.db.findOne({ _id: token });
    if (preview && preview.userId !== userId) {
      throw new ForbiddenException('Enlace no válido');
    }
    const doc: ReportDownloadDocument | null = await this.db.findOneAndUpdate(
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
   * Incrementa el contador de intentos TOTP. Al llegar a 3, marca el token
   * como consumido para prevenir fuerza bruta del código TOTP.
   * Devuelve el nuevo valor tras el increment.
   */
  async incrementTotpAttempts(token: string): Promise<number> {
    await this.db.updateOne(
      { _id: token, consumed: false },
      { $inc: { totpAttempts: 1 } },
    );
    const doc: ReportDownloadDocument | null = await this.db.findOne({ _id: token });
    const attempts = doc?.totpAttempts ?? 0;
    if (attempts >= MAX_TOTP_ATTEMPTS && doc && !doc.consumed) {
      await this.db.updateOne(
        { _id: token },
        { $set: { consumed: true, consumedAt: new Date() } },
      );
    }
    return attempts;
  }
}
