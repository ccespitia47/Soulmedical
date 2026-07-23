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

// Partial indexes: cada tipo de asignación tiene su propia restricción de
// unicidad. Sin estos, un índice ingenuo `{formId, userId}` rompe asignaciones
// de proyecto (donde formId es null para todas). Usamos partialFilterExpression
// para que cada índice solo aplique cuando los dos campos están presentes.
UserFormAssignmentSchema.index(
  { formId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      userId: { $type: 'number' },
    },
  },
);
UserFormAssignmentSchema.index(
  { projectId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      projectId: { $type: 'string' },
      userId: { $type: 'number' },
    },
  },
);
UserFormAssignmentSchema.index(
  { formId: 1, groupId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      groupId: { $type: 'string' },
    },
  },
);
UserFormAssignmentSchema.index(
  { projectId: 1, groupId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      projectId: { $type: 'string' },
      groupId: { $type: 'string' },
    },
  },
);

UserFormAssignmentSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});