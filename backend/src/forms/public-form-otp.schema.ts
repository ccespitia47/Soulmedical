import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PublicFormOtpDocument = PublicFormOtp & Document;

/**
 * Códigos OTP de 6 dígitos para acceso público a formularios protegidos
 * con verificación por email. Vida útil corta (2 min), max 3 intentos.
 *
 * El código se guarda HASHEADO (SHA-256). Mongo borra el documento solo
 * al pasar `expiresAt` gracias al TTL index.
 */
@Schema({
  collection: 'public_form_otps',
  timestamps: { createdAt: true, updatedAt: false },
})
export class PublicFormOtp {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  formId: string;

  @Prop({ required: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ default: 0 })
  attempts: number;

  // TTL index: Mongo borra el documento automáticamente cuando expiresAt < now.
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const PublicFormOtpSchema = SchemaFactory.createForClass(PublicFormOtp);
