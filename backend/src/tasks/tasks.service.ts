import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument, TaskStep } from './task.schema';
import { CreateTaskDto, SubmitTaskStepDto } from './tasks.dto';
import { EmailService } from '../email/email.service';
import type {
  EmailAttachment,
  EmailRecipient,
} from '../email/email.types';
import {
  FormSubmission,
  FormSubmissionDocument,
} from '../submissions/form-submission.schema';

export type TaskShareResponse = {
  formName: string;
  widgets: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  prefilledData: Record<string, string>;
};

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(FormSubmission.name)
    private submissionModel: Model<FormSubmissionDocument>,
    private readonly emailService: EmailService,
  ) {}

  // ── Crear tarea ────────────────────────────────────────────────────────────

  async create(
    dto: CreateTaskDto,
    createdById: number,
    createdByName: string,
  ): Promise<Task> {
    if (!dto.steps || dto.steps.length === 0) {
      throw new BadRequestException('Debe haber al menos un destinatario');
    }

    const steps: TaskStep[] = dto.steps.map((s, i) => ({
      order: i + 1,
      recipientEmail: s.recipientEmail.trim().toLowerCase(),
      recipientName: s.recipientName?.trim() || s.recipientEmail,
      token: crypto.randomUUID(),
      status: i === 0 ? 'in_progress' : 'pending',
      formData: {},
    }));

    const task = new this.taskModel({
      formId: dto.formId,
      folderId: dto.folderId,
      formName: dto.formName || 'Formulario',
      title: dto.title,
      description: dto.description,
      prefilledData: dto.prefilledData || {},
      widgets: dto.widgets ?? [],
      rules: dto.rules ?? [],
      emailTemplate: dto.emailTemplate ?? null,
      steps,
      status: 'in_progress',
      currentStepIndex: 0,
      createdById,
      createdByName,
      finalData: null,
      shareLink: dto.generateShareLink
        ? { token: crypto.randomUUID(), enabled: true }
        : null,
    });

    await task.save();

    // Enviar email al primer destinatario
    await this.sendStepEmail(task, 0);

    return task;
  }

  // ── Obtener tarea por token (público) ──────────────────────────────────────

  async getByToken(token: string): Promise<{ task: Task; stepIndex: number }> {
    const task = await this.taskModel.findOne({ 'steps.token': token }).lean();
    if (!task) throw new NotFoundException('Tarea no encontrada o link inválido');

    const stepIndex = task.steps.findIndex((s) => s.token === token);
    const step = task.steps[stepIndex];

    if (step.status === 'completed') {
      throw new BadRequestException('Este paso ya fue completado');
    }

    if (task.currentStepIndex !== stepIndex) {
      throw new BadRequestException(
        'Este paso no está disponible aún. Espera a que el paso anterior sea completado.',
      );
    }

    if (task.status === 'cancelled') {
      throw new BadRequestException('Esta tarea fue cancelada');
    }

    return { task, stepIndex };
  }

  // ── Completar un paso ──────────────────────────────────────────────────────

  async submitStep(
    token: string,
    dto: SubmitTaskStepDto,
    ipAddress?: string,
  ): Promise<{ completed: boolean; nextEmail?: string }> {
    const task = await this.taskModel.findOne({ 'steps.token': token });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const stepIndex = task.steps.findIndex((s) => s.token === token);
    if (stepIndex < 0) throw new NotFoundException('Paso no encontrado');

    const step = task.steps[stepIndex];
    if (step.status === 'completed') {
      throw new BadRequestException('Este paso ya fue completado');
    }

    // Marcar paso como completado
    task.steps[stepIndex].status = 'completed';
    task.steps[stepIndex].formData = dto.formData;
    task.steps[stepIndex].completedAt = new Date();
    if (ipAddress) task.steps[stepIndex].ipAddress = ipAddress;

    const nextIndex = stepIndex + 1;
    const hasNext = nextIndex < task.steps.length;

    if (hasNext) {
      // Activar siguiente paso
      task.steps[nextIndex].status = 'in_progress';
      task.currentStepIndex = nextIndex;
      task.markModified('steps');
      await task.save();

      // Enviar email al siguiente
      await this.sendStepEmail(task, nextIndex);

      return { completed: false, nextEmail: task.steps[nextIndex].recipientEmail };
    } else {
      // Todos los pasos completados → consolidar datos y cerrar
      const finalData = this.consolidateData(task);
      task.finalData = finalData;
      task.status = 'completed';
      task.completedAt = new Date();
      task.markModified('steps');
      await task.save();

      // Notificar usando el template del form y los attachments (PDF)
      // que el cliente generó al completar el último paso.
      await this.sendCompletionEmail(task, dto.attachments ?? []);

      return { completed: true };
    }
  }

  // ── Datos consolidados accesibles públicamente ─────────────────────────────

  collectPreviousStepsData(
    task: Task,
    untilStepIndex: number,
  ): Record<string, string> {
    const result: Record<string, string> = { ...task.prefilledData };
    for (let i = 0; i < untilStepIndex; i++) {
      for (const [key, value] of Object.entries(task.steps[i].formData ?? {})) {
        if (typeof value === 'string' && value.trim() === '') continue;
        result[key] = value;
      }
    }
    return result;
  }

  // ── Listar tareas (admin) ──────────────────────────────────────────────────

  async findAll(filters?: {
    status?: string;
    formId?: string;
    createdById?: number;
  }): Promise<Task[]> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.formId) query.formId = filters.formId;
    if (filters?.createdById) query.createdById = filters.createdById;

    return this.taskModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskModel.findById(id).lean();
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  /**
   * Tareas activas en las que el usuario participa: ya sea porque le toca
   * ahora ('in_progress'), porque su paso está aún por llegar ('pending'),
   * o porque ya completó su parte y queda esperando a alguien después
   * ('waiting'). Para flujos secuenciales con varias firmas, esto le permite
   * ver el progreso de toda la cadena.
   */
  async findMyPending(email: string): Promise<
    Array<{
      taskId: string;
      title: string;
      description?: string;
      formName: string;
      myStepOrder: number;
      totalSteps: number;
      currentStepOrder: number;
      myStatus: 'in_progress' | 'pending' | 'waiting';
      token: string;
      waitingForName?: string;
      waitingForEmail?: string;
      createdAt: Date;
    }>
  > {
    const lower = email.trim().toLowerCase();
    const tasks = await this.taskModel
      .find({
        status: { $in: ['in_progress', 'pending'] },
        'steps.recipientEmail': lower,
      })
      .sort({ createdAt: -1 })
      .lean();

    type Row = {
      taskId: string;
      title: string;
      description?: string;
      formName: string;
      myStepOrder: number;
      totalSteps: number;
      currentStepOrder: number;
      myStatus: 'in_progress' | 'pending' | 'waiting';
      token: string;
      waitingForName?: string;
      waitingForEmail?: string;
      createdAt: Date;
    };
    const result: Row[] = [];

    for (const task of tasks) {
      const mySteps = task.steps.filter((s) => s.recipientEmail === lower);
      if (mySteps.length === 0) continue;

      // Elegimos el "paso más relevante" del usuario en esta tarea:
      // primero in_progress, luego pending, y como último recurso un
      // completed (significa que ya terminó su parte y queda esperando).
      const inProgress = mySteps.find((s) => s.status === 'in_progress');
      const pending = mySteps.find((s) => s.status === 'pending');
      const completed = mySteps.find((s) => s.status === 'completed');
      const myStep = inProgress ?? pending ?? completed;
      if (!myStep) continue;

      const myStatus: 'in_progress' | 'pending' | 'waiting' =
        inProgress
          ? 'in_progress'
          : pending
          ? 'pending'
          : 'waiting';

      const currentStep =
        task.steps.find((s) => s.status === 'in_progress') ?? task.steps[0];
      const withMeta = task as unknown as { _id: string; createdAt: Date };

      result.push({
        taskId: withMeta._id,
        title: task.title,
        description: task.description,
        formName: task.formName,
        myStepOrder: myStep.order,
        totalSteps: task.steps.length,
        currentStepOrder: currentStep?.order ?? myStep.order,
        myStatus,
        // Token solo si es mi turno — los demás casos no deben poder abrir el form.
        token: myStatus === 'in_progress' ? myStep.token : '',
        waitingForName:
          myStatus !== 'in_progress' ? currentStep?.recipientName : undefined,
        waitingForEmail:
          myStatus !== 'in_progress' ? currentStep?.recipientEmail : undefined,
        createdAt: withMeta.createdAt,
      });
    }

    return result;
  }

  async cancel(id: string): Promise<Task> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.status === 'completed') {
      throw new BadRequestException('No se puede cancelar una tarea completada');
    }
    task.status = 'cancelled';
    await task.save();
    return task;
  }

  // ── Enlace compartible reutilizable ────────────────────────────────────────

  async findByShareToken(token: string): Promise<TaskShareResponse> {
    const task = await this.taskModel
      .findOne({ 'shareLink.token': token, 'shareLink.enabled': true })
      .lean();
    if (!task) throw new NotFoundException('Enlace no válido o desactivado');
    return {
      formName: task.formName,
      widgets: task.widgets ?? [],
      rules: task.rules ?? [],
      prefilledData: task.prefilledData ?? {},
    };
  }

  async submitFromShare(
    token: string,
    data: Record<string, unknown>,
  ): Promise<{ submissionId: string }> {
    const task = await this.taskModel
      .findOne({ 'shareLink.token': token, 'shareLink.enabled': true })
      .lean();
    if (!task) throw new NotFoundException('Enlace no válido o desactivado');

    // Crear FormSubmission normal en Mongo asociado al formId de la tarea.
    // NO consume el token: el link sigue funcionando para el próximo llenado.
    const submission = await this.submissionModel.create({
      formId: task.formId,
      formVersion: 1, // O tomar del task si existe; el schema tiene default
      data,
      metadata: { source: 'task-share', taskId: task._id, shareToken: token },
      submittedById: null, // Anónimo — no hay JWT
      templateSnapshot: null,
      pdfFilename: null,
    });

    return { submissionId: String(submission._id) };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private consolidateData(task: TaskDocument): Record<string, string> {
    // Combinar: prediligenciado + datos de cada paso. Los pasos más recientes
    // ganan, PERO un valor vacío del paso N no sobreescribe un valor real del
    // paso N-1: así cada widget conserva la primera firma/dato no vacío que
    // recibió, incluso si el último destinatario dejó su campo en blanco.
    const result: Record<string, string> = { ...task.prefilledData };
    for (const step of task.steps) {
      for (const [key, value] of Object.entries(step.formData ?? {})) {
        if (typeof value === 'string' && value.trim() === '') continue;
        result[key] = value;
      }
    }
    return result;
  }

  private getTaskUrl(token: string): string {
    const base = process.env.APP_BASE_URL || 'http://localhost:5173';
    return `${base}/task/${token}`;
  }

  private async sendStepEmail(task: TaskDocument, stepIndex: number): Promise<void> {
    const step = task.steps[stepIndex];
    const isFirst = stepIndex === 0;
    const taskUrl = this.getTaskUrl(step.token);
    const totalSteps = task.steps.length;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">📋 Tarea pendiente de completar</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>Hola ${step.recipientName || step.recipientEmail},</p>
      <p>${isFirst ? `<strong>${task.createdByName}</strong> te ha asignado una tarea para completar el formulario:` : `El paso anterior ha sido completado. Ahora es tu turno para continuar con el formulario:`}</p>
      <div style="background:#f8fafc;border-left:4px solid #00c2a8;padding:14px;border-radius:0 8px 8px 0;margin:16px 0;">
        <strong style="color:#111827;">${task.title}</strong>
        ${task.description ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${task.description}</p>` : ''}
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Formulario: ${task.formName} · Paso ${stepIndex + 1} de ${totalSteps}</p>
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${taskUrl}" style="display:inline-block;padding:14px 32px;background:#00c2a8;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          ✏️ Completar formulario
        </a>
      </p>
      <p style="font-size:12px;color:#9ca3af;">Este enlace es personal e intransferible. Expira cuando completes el formulario.</p>
    </div>
  </div>
</body></html>`;

    try {
      await this.emailService.sendEmail({
        subject: `📋 Tarea: ${task.title} — Paso ${stepIndex + 1} de ${totalSteps}`,
        emailBody: html,
        toRecipients: [{ type: 'static', email: step.recipientEmail }],
        senderName: 'SoulForms — Tareas',
      });
    } catch (err) {
      console.error(`[TasksService] Error enviando email paso ${stepIndex}:`, err);
    }
  }

  private async sendCompletionEmail(
    task: TaskDocument,
    attachments: EmailAttachment[],
  ): Promise<void> {
    const template = (task.emailTemplate ?? null) as
      | (Record<string, unknown> & {
          enabled?: boolean;
          subject?: string;
          emailBody?: string;
          senderName?: string;
          replyTo?: string;
          toRecipients?: EmailRecipient[];
          ccRecipients?: EmailRecipient[];
          bccRecipients?: EmailRecipient[];
        })
      | null;

    const finalData = task.finalData ?? {};

    // Si el form tiene template activo, lo respetamos (asunto, cuerpo,
    // destinatarios). Si no, mandamos un email mínimo a todos los participantes.
    if (template && template.enabled) {
      const placeholders = this.buildLabeledData(task, finalData);
      const subject = this.renderPlaceholders(
        template.subject || `✅ Completada: ${task.title}`,
        placeholders,
      );
      const body = this.renderPlaceholders(
        template.emailBody || '',
        placeholders,
      );

      try {
        await this.emailService.sendEmail({
          subject,
          emailBody: body,
          senderName: template.senderName || 'SoulForms — Tareas',
          replyTo: template.replyTo,
          toRecipients: template.toRecipients ?? [],
          ccRecipients: template.ccRecipients ?? [],
          bccRecipients: template.bccRecipients ?? [],
          formData: finalData,
          attachments,
        });
      } catch (err) {
        console.error(
          '[TasksService] Error enviando email de completado con template:',
          err,
        );
      }
      return;
    }

    // Fallback: notificación simple a todos los participantes.
    const allEmails = task.steps.map((s) => s.recipientEmail);
    const unique = [...new Set(allEmails)];

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">✅ Tarea completada</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>La tarea <strong>${task.title}</strong> del formulario <strong>${task.formName}</strong> ha sido completada por todos los participantes.</p>
      <p style="font-size:12px;color:#9ca3af;">Completada el ${new Date().toLocaleDateString('es-CO')}</p>
    </div>
  </div>
</body></html>`;

    try {
      await this.emailService.sendEmail({
        subject: `✅ Completada: ${task.title}`,
        emailBody: html,
        toRecipients: unique.map((e) => ({ type: 'static' as const, email: e })),
        senderName: 'SoulForms — Tareas',
        attachments,
      });
    } catch (err) {
      console.error('[TasksService] Error enviando email de completado:', err);
    }
  }

  // El cliente reemplaza ${campo} en cuerpo/asunto usando el label
  // normalizado del widget. Replicamos esa misma normalización aquí para
  // que el render del backend coincida con lo que ve el admin en el editor.
  private buildLabeledData(
    task: Task,
    finalData: Record<string, string>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    const widgets = (task.widgets ?? []) as Array<{
      id: string;
      label: string;
    }>;
    for (const w of widgets) {
      const key = (w.label || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/gi, '');
      out[key] = finalData[w.id] ?? '';
    }
    return out;
  }

  private renderPlaceholders(
    template: string,
    data: Record<string, string>,
  ): string {
    return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
      return data[key] ?? '';
    });
  }
}