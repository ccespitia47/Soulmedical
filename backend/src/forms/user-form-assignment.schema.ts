import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserFormAssignmentDocument = UserFormAssignment & Document;

@Schema({ timestamps: true, collection: 'user_form_assignments' })
export class UserFormAssignment {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  formId: string;

  @Prop({ required: true, index: true })
  userId: number;
}

export const UserFormAssignmentSchema = SchemaFactory.createForClass(UserFormAssignment);

// Índice compuesto para evitar asignaciones duplicadas
UserFormAssignmentSchema.index({ formId: 1, userId: 1 }, { unique: true });

UserFormAssignmentSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
