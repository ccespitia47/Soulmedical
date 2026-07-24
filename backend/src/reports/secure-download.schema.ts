import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SecureDownloadKind = 'excel' | 'bulk-pdf';
export type SecureDownloadDocument = SecureDownload & Document;

/**
 * Blob temporal de una descarga segura (reporte Excel o ZIP de PDFs). Vive
 * máximo `expiresAt - createdAt` (por diseño: 2 minutos). Mongo borra el
 * documento automáticamente por el TTL index. Un solo uso: se marca
 * `consumed = true` tras entrega o tras agotamiento de intentos TOTP.
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

  @Prop({ required: true, type: Buffer })
  encryptedBuffer: Buffer;

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
