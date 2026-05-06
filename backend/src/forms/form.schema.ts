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
}

export const FormSchema = SchemaFactory.createForClass(Form);

FormSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
