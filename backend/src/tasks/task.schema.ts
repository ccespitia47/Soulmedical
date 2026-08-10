import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Task & Document;

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type StepStatus = 'pending' | 'in_progress' | 'completed';

@Schema({ _id: false })
export class TaskStep {
  @Prop({ required: true })
  order: number;

  @Prop({ required: true })
  recipientEmail: string;

  @Prop()
  recipientName?: string;

  @Prop({ required: true })
  token: string;

  @Prop({ default: 'pending' })
  status: StepStatus;

  @Prop({ type: Object, default: {} })
  formData: Record<string, string>;

  @Prop()
  completedAt?: Date;

  @Prop()
  ipAddress?: string;
}

export const TaskStepSchema = SchemaFactory.createForClass(TaskStep);

@Schema({ _id: false })
export class TaskShareLink {
  @Prop({ required: true })
  token: string;

  @Prop({ default: true })
  enabled: boolean;
}

export const TaskShareLinkSchema = SchemaFactory.createForClass(TaskShareLink);

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  formId: string;

  @Prop({ required: true })
  formName: string;

  @Prop({ required: true, index: true })
  folderId: string;

  @Prop({ type: Object, default: {} })
  prefilledData: Record<string, string>;

  @Prop({ type: Array, default: [] })
  widgets: Record<string, unknown>[];

  // Reglas show/hide del formulario (copiadas al crear la tarea para que
  // la pantalla pública /task/:token las aplique sin depender del form vivo).
  @Prop({ type: Array, default: [] })
  rules: Record<string, unknown>[];

  // Snapshot del emailTemplate del form al momento de crear la tarea.
  // Se usa al completar el último paso para enviar el correo con PDF
  // a los destinatarios definidos en el template.
  @Prop({ type: Object, default: null })
  emailTemplate: Record<string, unknown> | null;

  @Prop({ type: [TaskStepSchema], default: [] })
  steps: TaskStep[];

  @Prop({ default: 'pending' })
  status: TaskStatus;

  @Prop({ default: 0 })
  currentStepIndex: number;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  createdById: number;

  @Prop({ required: true })
  createdByName: string;

  @Prop({ type: Object, default: null })
  finalData: Record<string, string> | null;

  @Prop()
  completedAt?: Date;

  @Prop()
  pdfUrl?: string;

  @Prop({ type: TaskShareLinkSchema, default: null })
  shareLink: TaskShareLink | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Índice único parcial: solo tareas con shareLink.token están indexadas.
// Permite lookups rápidos por token y garantiza que no haya colisiones,
// mientras que las tareas sin link (mayoría) no ocupan slots del índice.
TaskSchema.index(
  { 'shareLink.token': 1 },
  { unique: true, partialFilterExpression: { 'shareLink.token': { $type: 'string' } } },
);

TaskSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});