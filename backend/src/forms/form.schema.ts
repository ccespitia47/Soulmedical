import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FormDocument = Form & Document;

@Schema({ timestamps: true, collection: 'forms' })
export class Form {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, default: { widgets: [] } })
  schema: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  emailTemplate: Record<string, unknown> | null;

  @Prop({ default: 1 })
  version: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true, index: true })
  folderId: string;

  @Prop({ required: true })
  createdById: number;

  // ── Acceso público ──────────────────────────────────────────────────────
  @Prop({ default: false })
  isPublic: boolean;

  // Email de confirmación al usuario que envía (opcional)
  @Prop({ default: true })
  sendConfirmationEmail: boolean;

  // Si true, antes de mostrar el formulario al público se exige que el
  // visitante introduzca un correo registrado en la BD de usuarios y un
  // código OTP de 6 dígitos enviado a ese correo (ver public-form-otp.schema).
  @Prop({ default: false })
  requiresEmailVerification: boolean;
}

export const FormSchema = SchemaFactory.createForClass(Form);

FormSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});