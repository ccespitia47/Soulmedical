import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Task, TaskDocument, TaskStep } from './task.schema';
import { CreateTaskDto, SubmitTaskStepDto } from './tasks.dto';
import { EmailService } from '../email/email.service';
import type {
  EmailAttachment,
  EmailRecipient,
} from '../email/email.types';
import { SubmissionsService } from '../submissions/submissions.service';
import { FormsService } from '../forms/forms.service';
import type {
  TaskSummaryDto,
  TaskDetailDto,
  TaskRecipientDto,
  TaskSubmissionDto,
} from './tasks-list.dto';

export type TaskShareResponse = {
  formName: string;
  widgets: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  prefilledData: Record<string, string>;
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private readonly emailService: EmailService,
    private readonly submissionsService: SubmissionsService,
    private readonly formsService: FormsService,
  ) {}

  // Un enlace compartible es un ingreso anonimo publico: para servir el form
  // debe seguir activo, marcado como isPublic, y sin verificacion de email
  // obligatoria. Si el admin cierra el form despues, el link deja de servir.
  private async assertShareFormOpen(formId: string): Promise<void> {
    let form: Awaited<ReturnType<FormsService['findOne']>> | null = null;
    try {
      form = await this.formsService.findOne(formId);
    } catch {
      throw new NotFoundException('El formulario no esta disponible');
    }
    if (!form || !form.isActive) {
      throw new NotFoundException('El formulario no esta disponible');
    }
    if (form.isPublic === false || form.requiresEmailVerification === true) {
      throw new ForbiddenException(
        'Este formulario ya no acepta enlaces compartibles',
      );
    }
  }

  // ── Crear tarea ────────────────────────────────────────────────────────────

  async create(
    dto: CreateTaskDto,
    createdById: number,
    createdByName: string,
  ): Promise<Task> {
    const filteredSteps = (dto.steps ?? []).filter(
      (s) => s.recipientEmail?.trim() && s.recipientEmail.includes('@'),
    );
    // NO throw si steps está vacío — el flujo nuevo permite crear la tarea
    // primero (solo con shareLink) y agregar destinatarios después via
    // POST /api/tasks/:id/send.

    const steps: TaskStep[] = filteredSteps.map((s, i) => ({
      order: i + 1,
      recipientEmail: s.recipientEmail.trim().toLowerCase(),
      recipientName: s.recipientName?.trim() || s.recipientEmail,
      token: crypto.randomUUID(),
      status: i === 0 ? 'in_progress' : 'pending',
      formData: {},
      lastReminderAt: null,
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
        ? {
            token: randomBytes(8).toString('base64url'),
            enabled: true,
          }
        : null,
    });

    await task.save();

    // Enviar email al primer destinatario (si la tarea se creó con steps).
    if (task.steps.length > 0) {
      await this.sendStepEmail(task, 0);
    }

    return task;
  }

  // ── Enviar tarea (agregar destinatarios y disparar el primer paso) ────────

  async sendTask(
    taskId: string,
    steps: Array<{ recipientEmail: string; recipientName?: string }>,
    userId: number,
  ): Promise<{ ok: true; sentCount: number }> {
    const validSteps = steps.filter(
      (s) => s.recipientEmail?.trim() && s.recipientEmail.includes('@'),
    );
    if (validSteps.length === 0) {
      throw new BadRequestException(
        'Se requiere al menos un destinatario con email válido',
      );
    }

    // Generar tokens únicos por step (mismo patrón que create). El primer
    // paso arranca 'in_progress' (igual que create) para que quede claro
    // de inmediato a quién le toca completar.
    const newSteps: TaskStep[] = validSteps.map((s, i) => ({
      order: i + 1,
      recipientEmail: s.recipientEmail.trim().toLowerCase(),
      recipientName: s.recipientName?.trim() || s.recipientEmail.trim(),
      token: crypto.randomUUID(),
      status: i === 0 ? 'in_progress' : 'pending',
      formData: {},
      lastReminderAt: null,
    }));

    // Update atómico condicionado a que la tarea siga sin steps: evita que
    // dos llamadas concurrentes a /send (doble click, retry de red) pisen
    // el array de steps una encima de otra y disparen el email duplicado.
    // Nota: _id de Task es un string UUID (ver task.schema.ts), no un
    // ObjectId de Mongo, por eso se compara tal cual.
    // Cast del filtro: el schema declara _id como string (UUID), pero el
    // tipo Document base de mongoose lo infiere como ObjectId, lo que
    // produce un choque de tipos imposible ("string & ObjectId"). Mismo
    // patrón que consents.seeder.ts para el mismo problema.
    const filter = {
      _id: taskId,
      createdById: userId,
      'steps.0': { $exists: false },
    } as Record<string, unknown>;
    const updated = await this.taskModel.findOneAndUpdate(
      filter,
      { $set: { steps: newSteps, currentStepIndex: 0 } },
      { new: true },
    );

    if (!updated) {
      const existing = await this.taskModel.findById(taskId).lean();
      if (!existing) throw new NotFoundException('Tarea no encontrada');
      if (existing.createdById !== userId) {
        throw new ForbiddenException('No autorizado');
      }
      throw new ConflictException('La tarea ya fue enviada');
    }

    // Dispara correo al primer destinatario (mismo patrón que create actual;
    // sendStepEmail ya atrapa sus propios errores y no re-lanza).
    await this.sendStepEmail(updated, 0);
    return { ok: true, sentCount: newSteps.length };
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

      // Crear un registro (submission) ligado a la tarea, igual que el flujo de
      // enlace compartible. Así la tarea completada por correo aparece en el
      // reporte de Tareas con su "Ver PDF" (si el form tiene plantilla) y la
      // descarga masiva encuentra registros. No rompemos el cierre de la tarea
      // si esto falla — se registra y se sigue con el correo.
      try {
        await this.submissionsService.submit(
          task.formId,
          {
            data: finalData,
            metadata: { source: 'task-email', taskId: task._id },
          },
          undefined, // userId — el destinatario no tiene JWT
          task._id, // taskId — permite listarla en GET /tasks/:id/detail
        );
      } catch (err) {
        this.logger.error(
          `[submitStep] No se pudo crear submission para tarea ${task._id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
          err instanceof Error ? err.stack : undefined,
        );
      }

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

  // ── Reportes de tarea (pestaña "Reportes") ─────────────────────────────────

  /** Tareas de un formulario con stats agregadas, para la pestaña Reportes. */
  async listByForm(formId: string): Promise<TaskSummaryDto[]> {
    const tasks = await this.taskModel
      .find({ formId })
      .sort({ createdAt: -1 })
      .lean();

    return tasks.map((t) => {
      const withMeta = t as unknown as { _id: string; createdAt?: Date };
      return {
        id: withMeta._id,
        title: t.title,
        status: t.status,
        createdAt: (withMeta.createdAt ?? new Date()).toISOString(),
        createdByName: t.createdByName,
        totalRecipients: t.steps.length,
        completedCount: t.steps.filter((s) => s.status === 'completed').length,
        pendingCount: t.steps.filter((s) => s.status !== 'completed').length,
        hasShareLink: !!t.shareLink?.token,
      };
    });
  }

  /** Detalle de una tarea: destinatarios (con estado de reenvío) + submissions ligadas. */
  async getDetail(taskId: string): Promise<TaskDetailDto> {
    const task = await this.taskModel.findById(taskId).lean();
    if (!task) throw new NotFoundException('Tarea no encontrada');
    const withMeta = task as unknown as { _id: string; createdAt: Date };

    const now = Date.now();
    const TEN_MIN = 10 * 60 * 1000;
    const recipients: TaskRecipientDto[] = task.steps.map((s, i) => ({
      stepIndex: i,
      email: s.recipientEmail,
      name: s.recipientName ?? s.recipientEmail,
      status: s.status,
      submittedAt: s.completedAt ? s.completedAt.toISOString() : null,
      canResend:
        s.status !== 'completed' &&
        (!s.lastReminderAt || now - s.lastReminderAt.getTime() > TEN_MIN),
      lastResendAt: s.lastReminderAt ? s.lastReminderAt.toISOString() : null,
    }));

    // Submissions ligadas a esta tarea (flujo de enlace compartible; ver
    // submitFromShare más abajo, que persiste taskId en cada submission).
    const subs = await this.submissionsService.findByTaskId(taskId);
    const submissions: TaskSubmissionDto[] = subs.map((s) => ({
      id: String(s._id),
      submittedAt: s.submittedAt.toISOString(),
      // Las submissions de tarea llegan siempre por el link público (sin
      // JWT), así que submittedById es null — no hay nombre real que
      // mostrar todavía. Task 6 puede enriquecer esto si aplica.
      userName: s.submittedById != null ? `Usuario #${s.submittedById}` : 'Anónimo',
      hasPdf: !!s.templateSnapshot,
      summary: {}, // ver Task 6 para poblar; MVP lo deja vacío
    }));

    // Externos: personas sin cuenta que diligenciaron la tarea vía el enlace
    // compartible (metadata.source === 'task-share'). Las completadas por
    // correo llevan source 'task-email' y no cuentan como externas.
    const externalCount = subs.filter(
      (s) =>
        (s.metadata as { source?: string } | null | undefined)?.source ===
        'task-share',
    ).length;

    const baseUrl = process.env.APP_BASE_URL ?? '';
    const shareLinkUrl = task.shareLink?.token
      ? `${baseUrl}/t/${task.shareLink.token}`
      : null;

    return {
      id: withMeta._id,
      title: task.title,
      status: task.status,
      createdAt: withMeta.createdAt.toISOString(),
      createdByName: task.createdByName,
      shareLinkUrl,
      recipients,
      submissions,
      externalCount,
    };
  }

  /** Reenvía manualmente el email de un paso pendiente (botón "Reenviar" en Reportes). */
  async resendStep(
    taskId: string,
    stepIndex: number,
    userId: number,
  ): Promise<{ ok: true; sentAt: string }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.createdById !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    const step = task.steps[stepIndex];
    if (!step) throw new BadRequestException('Step inexistente');
    if (step.status === 'completed') {
      throw new BadRequestException('Ese destinatario ya completó');
    }

    const now = new Date();
    const TEN_MIN = 10 * 60 * 1000;
    if (
      step.lastReminderAt &&
      now.getTime() - step.lastReminderAt.getTime() < TEN_MIN
    ) {
      const restante = Math.ceil(
        (TEN_MIN - (now.getTime() - step.lastReminderAt.getTime())) / 60_000,
      );
      throw new HttpException(
        `Espera ${restante} min para reenviar de nuevo`,
        429,
      );
    }

    const ok = await this.sendStepEmail(task, stepIndex);
    if (!ok) {
      throw new HttpException('No se pudo enviar el correo', 502);
    }
    step.lastReminderAt = now;
    task.markModified('steps');
    await task.save();
    return { ok: true, sentAt: now.toISOString() };
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

  // ── Toggle de enlace compartible (crear/desactivar) ────────────────────────

  async toggleShareLink(
    taskId: string,
    enabled: boolean,
    userId: number,
  ): Promise<{ shareLinkUrl: string | null }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.createdById !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    if (enabled) {
      // Idempotente: si ya hay link con enabled=true, no rotar el token.
      if (task.shareLink?.enabled) {
        // no-op, devolver el actual
      } else {
        task.shareLink = {
          token: randomBytes(8).toString('base64url'),
          enabled: true,
        };
        await task.save();
      }
    } else {
      // Desactivar: link viejo deja de funcionar (getByShareToken filtra enabled:true).
      task.shareLink = null;
      await task.save();
    }

    const baseUrl = process.env.APP_BASE_URL ?? '';
    const shareLinkUrl = task.shareLink?.token
      ? `${baseUrl}/t/${task.shareLink.token}`
      : null;
    return { shareLinkUrl };
  }

  async cancel(id: string, userId: number): Promise<Task> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.createdById !== userId) {
      throw new ForbiddenException('No autorizado');
    }
    if (task.status === 'completed') {
      // Defensa en profundidad: la UI solo muestra el botón "Eliminar" para
      // tareas in_progress, pero un curl directo no debe poder revertir una
      // completada a "nula" (perdería la info del cierre exitoso).
      throw new BadRequestException('No se puede eliminar una tarea completada');
    }
    if (task.status === 'cancelled') {
      return task; // idempotente
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
    if (task.status === 'cancelled') {
      throw new NotFoundException('Enlace no válido o desactivado');
    }

    // Si el admin cerro el form (isActive=false), lo despublico
    // (isPublic=false), o le puso verificacion de email, el link deja de
    // servir: 404 aqui para que la pagina publica muestre "enlace no valido"
    // en vez de renderizar un form muerto.
    await this.assertShareFormOpen(task.formId);

    return {
      formName: task.formName,
      widgets: task.widgets ?? [],
      rules: task.rules ?? [],
      prefilledData: task.prefilledData ?? {},
    };
  }

  /**
   * Búsqueda pública para un widget de tipo "search" dentro de un formulario
   * compartido por enlace. La página pública no tiene sesión, así que no puede
   * llamar al endpoint autenticado de búsqueda de envíos. Aquí resolvemos el
   * widget por su id DENTRO de la tarea (no aceptamos un formId arbitrario del
   * cliente) y solo servimos la fuente `form_submissions`: las demás
   * (excel_web/sql/group) requieren credenciales del backend y no se exponen
   * anónimamente; `google_sheets` no pasa por aquí (lee directo de Google).
   */
  async searchFromShare(
    token: string,
    widgetId: string,
    q: string,
  ): Promise<{ results: Record<string, unknown>[] }> {
    const task = await this.taskModel
      .findOne({ 'shareLink.token': token, 'shareLink.enabled': true })
      .lean();
    if (!task) throw new NotFoundException('Enlace no válido o desactivado');
    await this.assertShareFormOpen(task.formId);

    const query = (q ?? '').trim();
    if (!query || !widgetId) return { results: [] };

    const widgets = (task.widgets ?? []) as Array<{
      id?: string;
      type?: string;
      config?: Record<string, unknown>;
    }>;
    const widget = widgets.find((w) => w?.id === widgetId);
    const config = (widget?.config ?? {}) as {
      sourceType?: string;
      sourceFormId?: string;
      searchableFields?: string[];
    };

    if (
      !widget ||
      widget.type !== 'search' ||
      config.sourceType !== 'form_submissions' ||
      !config.sourceFormId
    ) {
      return { results: [] };
    }

    const fields = Array.isArray(config.searchableFields)
      ? config.searchableFields
      : [];
    return this.submissionsService.searchSubmissions(
      config.sourceFormId,
      query,
      fields,
      20,
    );
  }

  async submitFromShare(
    token: string,
    data: Record<string, unknown>,
  ): Promise<{ submissionId: string }> {
    const task = await this.taskModel
      .findOne({ 'shareLink.token': token, 'shareLink.enabled': true })
      .lean();
    if (!task) throw new NotFoundException('Enlace no válido o desactivado');
    if (task.status === 'cancelled') {
      throw new NotFoundException('Enlace no válido o desactivado');
    }

    // SubmissionsService.submit() solo valida isActive del form, NO chequea
    // isPublic ni requiresEmailVerification. Un attacker podria reusar un link
    // viejo aunque el admin haya restringido el form: validamos aca antes de
    // aceptar el submit anonimo.
    await this.assertShareFormOpen(task.formId);

    // Filtramos data a solo los widget ids del snapshot de la tarea. Sin este
    // filtro un caller anonimo podria persistir keys arbitrarias en la
    // submission (junk que no corresponde a ningun campo del form).
    const validWidgetIds = new Set(
      (task.widgets ?? [])
        .map((w) => (w as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string'),
    );
    const filteredData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (validWidgetIds.has(key)) filteredData[key] = value;
    }

    // Delega a SubmissionsService.submit(): hace offloadBinaries (firmas/fotos
    // a GridFS), valida el form y setea formVersion correcto. NO consume el
    // token: el link sigue funcionando para el próximo llenado.
    const submission = await this.submissionsService.submit(
      task.formId,
      {
        data: filteredData,
        metadata: { source: 'task-share', taskId: task._id, shareToken: token },
      },
      undefined, // userId — anónimo, no hay JWT
      task._id, // taskId — permite listar esta submission en GET /tasks/:id/detail
    );

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

  // Público: Task 4 (cron de recordatorios automáticos) y el endpoint de
  // reenvío manual (resendStep) lo invocan desde fuera de esta clase.
  async sendStepEmail(task: TaskDocument, stepIndex: number): Promise<boolean> {
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
      return true;
    } catch (err) {
      console.error(`[TasksService] Error enviando email paso ${stepIndex}:`, err);
      return false;
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