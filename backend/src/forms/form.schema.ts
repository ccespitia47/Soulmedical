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

  // LEGACY: configuración singular de email. Se mantiene para compat con
  // formularios creados antes de que `emailTemplates[]` existiera. Al leer,
  // si `emailTemplates` está vacío pero `emailTemplate` existe, el singular
  // se trata como la primera y única configuración.
  @Prop({ type: Object, default: null })
  emailTemplate: Record<string, unknown> | null;

  // Múltiples configuraciones de email por formulario. Cada entry es
  // autónoma (sus propios destinatarios, cuerpo, asunto, PDF). Al enviar
  // el formulario se disparan todas en paralelo.
  //
  // OJO con el tipo: tanto `[Object]` como `[Schema.Types.Mixed]` rompen
  // en Mongoose moderno al cargar documentos legacy (sin este campo). Al
  // aplicar el default `[]`, SchemaArray.cast falla con
  // `doc.schema.indexedPaths is not a function`. `type: Array` sin
  // especificar el tipo de elemento sortea esa ruta — es el mismo patrón
  // que ya usan `task.widgets` y `task.rules`, que persisten arrays de
  // objetos arbitrarios sin este problema.
  @Prop({ type: Array, default: [] })
  emailTemplates: Record<string, unknown>[];

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