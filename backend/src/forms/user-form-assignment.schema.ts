import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserFormAssignmentDocument = UserFormAssignment & Document;

@Schema({ timestamps: true, collection: 'user_form_assignments' })
export class UserFormAssignment {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ type: String, required: false, index: true, default: null })
  formId: string | null;

  @Prop({ type: String, required: false, index: true, default: null })
  projectId: string | null;

  @Prop({ type: Number, required: false, index: true, default: null })
  userId: number | null;

  @Prop({ type: String, required: false, index: true, default: null })
  groupId: string | null;
}

export const UserFormAssignmentSchema = SchemaFactory.createForClass(UserFormAssignment);

UserFormAssignmentSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});