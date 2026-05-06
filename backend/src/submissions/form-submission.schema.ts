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
}

export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

// Índice compuesto para consultas frecuentes: respuestas de un form ordenadas por fecha
FormSubmissionSchema.index({ formId: 1, submittedAt: -1 });

FormSubmissionSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
