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

  @Prop({ type: String, required: false, index: true, default: null })
  folderId: string | null;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  excluded: boolean;
}

export const UserFormAssignmentSchema = SchemaFactory.createForClass(UserFormAssignment);

// Partial indexes: cada tipo de asignación tiene su propia restricción de
// unicidad. Sin estos, un índice ingenuo `{formId, userId}` rompe asignaciones
// de proyecto (donde formId es null para todas). Usamos partialFilterExpression
// para que cada índice solo aplique cuando los dos campos están presentes.
// Todos los índices de asignaciones positivas filtran excluded: false.
UserFormAssignmentSchema.index(
  { formId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: false,
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
      excluded: false,
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
      excluded: false,
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
      excluded: false,
    },
  },
);

// Positivos por carpeta
UserFormAssignmentSchema.index(
  { folderId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: false,
    },
  },
);
UserFormAssignmentSchema.index(
  { folderId: 1, groupId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: false,
    },
  },
);

// Exclusiones a nivel form
UserFormAssignmentSchema.index(
  { formId: 1, userId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: true,
    },
  },
);
UserFormAssignmentSchema.index(
  { formId: 1, groupId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      formId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: true,
    },
  },
);

// Exclusiones a nivel carpeta
UserFormAssignmentSchema.index(
  { folderId: 1, userId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      userId: { $type: 'number' },
      excluded: true,
    },
  },
);
UserFormAssignmentSchema.index(
  { folderId: 1, groupId: 1, excluded: 1 },
  {
    unique: true,
    partialFilterExpression: {
      folderId: { $type: 'string' },
      groupId: { $type: 'string' },
      excluded: true,
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