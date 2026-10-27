import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Task & Document;

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type StepStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Un "respondent" es UNA persona dentro de un paso. Un paso puede tener
 * varios respondents en PARALELO (todos reciben el formulario a la vez, cada
 * uno con su propio token, y el paso solo avanza al siguiente cuando TODOS
 * lo han diligenciado). En tareas viejas (previas a este cambio) `respondents`
 * puede estar vacío; en ese caso se sintetiza uno a partir de los campos
 * legacy del step (recipientEmail/token/formData) al momento de la lectura.
 */
@Schema({ _id: false })
export class TaskRespondent {
  @Prop({ required: true })
  email: string;

  @Prop()
  name?: string;

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

  @Prop({ type: Date, default: null })
  lastReminderAt: Date | null;
}

export const TaskRespondentSchema = SchemaFactory.createForClass(TaskRespondent);

@Schema({ _id: false })
export class TaskStep {
  @Prop({ required: true })
  order: number;

  // Campos LEGACY: se mantienen poblados con los datos del PRIMER respondent
  // para no romper reads viejos (findMyPending, reportes de tareas creadas
  // antes del cambio, etc.). Los flujos nuevos usan `respondents` como fuente
  // de verdad.
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

  @Prop({ type: Date, default: null })
  lastReminderAt: Date | null;

  // Nuevo modelo: N respondents paralelos por paso. Si vacío ⇒ tarea legacy
  // y se sintetiza uno a partir de los campos de arriba.
  @Prop({ type: [TaskRespondentSchema], default: [] })
  respondents: TaskRespondent[];
}

export const TaskStepSchema = SchemaFactory.createForClass(TaskStep);

@Schema({ _id: false })
export class TaskShareLink {
  @Prop({ required: true })
  token: string;

  @Prop({ default: true })
  enabled: boolean;

  // Enlace de un solo uso: al primer submit exitoso vía submitFromShare, se
  // fuerza enabled=false (ver tasks.service.ts). Default false para que
  // docs viejos sin el campo se comporten como antes (link reutilizable).
  @Prop({ type: Boolean, required: true, default: false })
  oneShot: boolean;
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

  // LEGACY: snapshot singular del emailTemplate del form al crear la tarea.
  // Se mantiene para tareas creadas antes de que `emailTemplates[]` existiera.
  @Prop({ type: Object, default: null })
  emailTemplate: Record<string, unknown> | null;

  // Snapshot de las N configuraciones de email del form al crear la tarea.
  // Al completar el último paso, cada entry habilitada dispara UN email
  // propio (ver tasks.service.sendCompletionEmail). Fuente de verdad cuando
  // no está vacío; si está vacío se cae al `emailTemplate` singular.
  @Prop({ type: [Object], default: [] })
  emailTemplates: Record<string, unknown>[];

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