import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SecureDownloadKind = 'excel' | 'bulk-pdf';
export type SecureDownloadDocument = SecureDownload & Document;

/**
 * Blob temporal de una descarga segura (reporte Excel o ZIP de PDFs). Vive
 * máximo `expiresAt - createdAt` (por diseño: 2 minutos). Mongo borra el
 * documento automáticamente por el TTL index. Un solo uso: se marca
 * `consumed = true` tras entrega o tras agotamiento de intentos TOTP.
 *
 * El blob cifrado NO vive en el documento — se guarda en GridFS (bucket
 * `submission_files`) y aquí solo persistimos su `encryptedFileId`. Sin
 * esto, bulk-pdf ZIPs (~50 MB / 500 PDFs) revientan el límite BSON de 16 MB.
 */
@Schema({
  collection: 'secure_downloads',
  timestamps: { createdAt: true, updatedAt: false },
})
export class SecureDownload {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, enum: ['excel', 'bulk-pdf'], default: 'excel' })
  kind: SecureDownloadKind;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  formName: string;

  // ObjectId (string) del blob cifrado en GridFS. `consume()` lo descarga
  // y borra tras entregarlo. Puede quedar huérfano si el TTL de Mongo
  // borra este doc primero → limpieza best-effort vía `cleanupExpired()`.
  @Prop({ type: String, required: true })
  encryptedFileId: string;

  @Prop({ required: true })
  filename: string;

  // TTL index: Mongo borra el documento (y el Buffer) cuando expiresAt < now.
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;

  @Prop({ default: false })
  consumed: boolean;

  @Prop({ type: Date, default: null })
  consumedAt: Date | null;

  // Contador de intentos TOTP fallidos. Al llegar a 3 se marca consumed=true.
  @Prop({ default: 0 })
  totpAttempts: number;

  @Prop({ type: String, default: null })
  createdIp: string | null;
}

export const SecureDownloadSchema = SchemaFactory.createForClass(SecureDownload);
