import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FormSubmissionDocument = FormSubmission & Document;

@Schema({ collection: 'form_submissions' })
export class FormSubmission {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  formId: string;

  @Prop({ required: true })
  formVersion: number;

  @Prop({ type: Number, default: null })
  submittedById: number | null;

  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;

  @Prop({ default: () => new Date(), index: true })
  submittedAt: Date;

  // ── Snapshot del template HTML del momento del envío ─────────────────────
  // Se guarda el pdfTemplate con placeholders ${label} SIN interpolar,
  // para poder regenerar el PDF con el formato original aunque el template
  // del formulario cambie más adelante. Peso típico 2-20 KB (no incluye
  // binarios: firmas/fotos siguen en GridFS con referencia gridfs:<id>).
  // null si el formulario no tiene pdfTemplate configurado.
  @Prop({ type: String, default: null })
  templateSnapshot: string | null;

  // Nombre del archivo PDF sugerido al descargar
  @Prop({ type: String, default: null })
  pdfFilename: string | null;
}

export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

FormSubmissionSchema.index({ formId: 1, submittedAt: -1 });

FormSubmissionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});