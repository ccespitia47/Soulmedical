import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Task, TaskDocument, TaskRespondent, TaskStep } from './task.schema';
import { CreateTaskDto, SubmitTaskStepDto } from './tasks.dto';
import { EmailService } from '../email/email.service';
import type {
  EmailAttachment,
  EmailRecipient,
} from '../email/email.types';
import { SubmissionsService } from '../submissions/submissions.service';
import { FormsService } from '../forms/forms.service';
import { UsersService } from '../users/users.service';
import type {
  TaskSummaryDto,
  TaskSummaryPageDto,
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
    private readonly usersService: UsersService,
  ) {}

  /**
   * Devuelve la lista canónica de respondents de un paso. Si el paso ya vive
   * con el modelo nuevo (`respondents.length > 0`), esa lista manda. Si es
   * legacy (creado antes de que existiera paralelismo), sintetiza uno solo
   * a partir de los campos viejos del step para que el resto del código
   * pueda trabajar con una única representación.
   */
  private getRespondents(step: TaskStep): TaskRespondent[] {
    if (step.respondents && step.respondents.length > 0) {
      return step.respondents;
    }
    return [
      {
        email: step.recipientEmail,
        name: step.recipientName,
        token: step.token,
        // Un step legacy no distingue entre in_progress/completed por respondent,
        // así que reflejamos el estado del step entero.
        status: step.status,
        formData: step.formData ?? {},
        completedAt: step.completedAt,
        ipAddress: step.ipAddress,
        lastReminderAt: step.lastReminderAt,
      },
    ];
  }

  /**
   * Construye un TaskStep completo (con respondents[] + campos legacy
   * poblados desde el primero) a partir de la lista de emails paralelos que
   * deben responder ESTE paso. `activeNow=true` marca a todos los respondents
   * como 'in_progress' (paso 0 al crear/enviar, o cuando el paso anterior
   * cerró). Nunca cambia el status del paso al de un respondent individual.
   */
  private buildStep(
    order: number,
    emails: string[],
    primaryName: string | undefined,
    activeNow: boolean,
  ): TaskStep {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of emails) {
      const e = (raw ?? '').trim().toLowerCase();
      if (!e || !e.includes('@') || seen.has(e)) continue;
      seen.add(e);
      unique.push(e);
    }
    if (unique.length === 0) {
      throw new BadRequestException(
        'Se requiere al menos un email válido por paso',
      );
    }

    const respondents: TaskRespondent[] = unique.map((email, idx) => ({
      email,
      name: idx === 0 && primaryName ? primaryName : email,
      token: crypto.randomUUID(),
      status: activeNow ? 'in_progress' : 'pending',
      formData: {},
      completedAt: undefined,
      ipAddress: undefined,
      lastReminderAt: null,
    }));

    const first = respondents[0];
    return {
      order,
      recipientEmail: first.email,
      recipientName: first.name,
      token: first.token,
      status: activeNow ? 'in_progress' : 'pending',
      formData: {},
      completedAt: undefined,
      ipAddress: undefined,
      lastReminderAt: null,
      respondents,
    };
  }

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

    const steps: TaskStep[] = filteredSteps.map((s, i) => {
      // Emails paralelos del paso: si el cliente mandó recipientEmails (flujo
      // nuevo), esa lista manda; si no, se usa [recipientEmail] (compat).
      const emails =
        Array.isArray(s.recipientEmails) && s.recipientEmails.length > 0
          ? s.recipientEmails
          : [s.recipientEmail];
      return this.buildStep(
        i + 1,
        emails,
        s.recipientName?.trim() || undefined,
        i === 0, // solo el primer paso arranca activo
      );
    });

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
      emailTemplates: dto.emailTemplates ?? [],
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
            oneShot: dto.oneShotLink === true,
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
    steps: Array<{
      recipientEmail: string;
      recipientName?: string;
      recipientEmails?: string[];
    }>,
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

    // Cada step puede tener múltiples emails paralelos (recipientEmails). El
    // primer paso arranca con todos sus respondents 'in_progress' (envío
    // simultáneo); los pasos siguientes quedan 'pending' hasta que el actual
    // se cierre (submitStep detecta "todos completaron" y avanza).
    const newSteps: TaskStep[] = validSteps.map((s, i) => {
      const emails =
        Array.isArray(s.recipientEmails) && s.recipientEmails.length > 0
          ? s.recipientEmails
          : [s.recipientEmail];
      return this.buildStep(
        i + 1,
        emails,
        s.recipientName?.trim() || undefined,
        i === 0,
      );
    });

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
    // Buscar por token: puede ser el token legacy del step o el token de
    // cualquier respondent del step (flujo paralelo nuevo).
    const task = await this.taskModel
      .findOne({
        $or: [
          { 'steps.token': token },
          { 'steps.respondents.token': token },
        ],
      })
      .lean();
    if (!task) throw new NotFoundException('Tarea no encontrada o link inválido');

    // Encontrar en qué step vive este token
    const stepIndex = task.steps.findIndex(
      (s) =>
        s.token === token ||
        (s.respondents ?? []).some((r) => r.token === token),
    );
    if (stepIndex < 0) {
      throw new NotFoundException('Tarea no encontrada o link inválido');
    }
    const step = task.steps[stepIndex];
    const respondents = this.getRespondents(step);
    const respondent = respondents.find((r) => r.token === token);

    // Si el respondent específico ya diligenció, no puede volver a entrar
    // aunque el step siga abierto porque falten otros paralelos.
    if (respondent && respondent.status === 'completed') {
      throw new BadRequestException('Este paso ya fue completado');
    }
    // Fallback legacy: step sin respondents individuales
    if (!respondent && step.status === 'completed') {
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
  ): Promise<{
    completed: boolean;
    nextEmail?: string;
    waitingCount?: number;
  }> {
    const task = await this.taskModel.findOne({
      $or: [
        { 'steps.token': token },
        { 'steps.respondents.token': token },
      ],
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const stepIndex = task.steps.findIndex(
      (s) =>
        s.token === token ||
        (s.respondents ?? []).some((r) => r.token === token),
    );
    if (stepIndex < 0) throw new NotFoundException('Paso no encontrado');

    const step = task.steps[stepIndex];

    // Localizar respondent específico. En tarea legacy (sin respondents[]),
    // el "respondent" es el step entero.
    const respondents = step.respondents ?? [];
    const respondentIndex = respondents.findIndex((r) => r.token === token);
    const isLegacyLone = respondentIndex < 0;

    if (isLegacyLone && step.status === 'completed') {
      throw new BadRequestException('Este paso ya fue completado');
    }
    if (!isLegacyLone && respondents[respondentIndex].status === 'completed') {
      throw new BadRequestException('Este destinatario ya diligenció');
    }

    const now = new Date();

    if (isLegacyLone) {
      // Camino legacy — el step se completa como un solo respondent.
      task.steps[stepIndex].status = 'completed';
      task.steps[stepIndex].formData = dto.formData;
      task.steps[stepIndex].completedAt = now;
      if (ipAddress) task.steps[stepIndex].ipAddress = ipAddress;
    } else {
      // ── Camino paralelo — dos flujos claros según cuántos steps tenga ──
      //
      //  Flujo 1 (task.steps.length === 1):
      //   Un solo paso con N respondents paralelos. Cada uno llena SU propia
      //   copia y se genera SU submission al enviar (1 PDF por persona).
      //   Cuando TODOS completan → email de resumen al creador.
      //
      //  Flujo 2 (task.steps.length > 1):
      //   Firmas secuenciales. Cada respondent del step k solo guarda su
      //   formData (NO se crea submission todavía). Cuando TODOS del step k
      //   completan → avanza al step k+1. Al firmar el último step, para cada
      //   respondent del step 0 se crea SU submission consolidada (prellenado
      //   + su formData del step 0 + formData mergeado de todos los steps
      //   posteriores). Los del step 0 reciben aviso con enlace al PDF.
      task.steps[stepIndex].respondents[respondentIndex].status = 'completed';
      task.steps[stepIndex].respondents[respondentIndex].formData = dto.formData;
      task.steps[stepIndex].respondents[respondentIndex].completedAt = now;
      if (ipAddress) {
        task.steps[stepIndex].respondents[respondentIndex].ipAddress = ipAddress;
      }

      const isMultiStep = task.steps.length > 1;

      if (!isMultiStep) {
        // ═════ FLUJO 1: submission independiente por respondent ══════════
        const myFinalData: Record<string, string> = { ...task.prefilledData };
        for (const [k, v] of Object.entries(dto.formData ?? {})) {
          if (typeof v === 'string' && v.trim() === '') continue;
          myFinalData[k] = v;
        }

        const stillPending = task.steps[stepIndex].respondents.filter(
          (r) => r.status !== 'completed',
        );
        const isLastRespondent = stillPending.length === 0;
        if (isLastRespondent) {
          task.steps[stepIndex].status = 'completed';
          task.steps[stepIndex].completedAt = now;
          task.status = 'completed';
          task.completedAt = now;
        }
        task.markModified('steps');
        await task.save();

        // Persistir submission de ESTE respondent. Si falla, propagamos:
        // el destinatario reintenta y no enviamos email de completado con
        // una submission fantasma.
        try {
          await this.submissionsService.submit(
            task.formId,
            {
              data: myFinalData,
              metadata: {
                source: 'task-email-parallel',
                taskId: task._id,
                respondentEmail:
                  task.steps[stepIndex].respondents[respondentIndex].email,
              },
            },
            undefined,
            task._id,
          );
        } catch (err) {
          this.logger.error(
            `[submitStep] FALLO submission paralela ${task._id} respondent ${respondentIndex}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            err instanceof Error ? err.stack : undefined,
          );
          throw new InternalServerErrorException(
            'No pudimos guardar tu envío. Por favor intenta de nuevo en unos segundos.',
          );
        }

        // ── Email al respondent SOLO si el formulario tiene formato PDF ──
        // El cliente (TaskPage) genera el PDF y lo manda como attachment
        // únicamente cuando el emailTemplate tiene attachPDF activo. Si
        // llegó attachment → el formulario tiene formato → mandamos al
        // respondent SU correo con SU PDF al instante. Si no llegó
        // attachment → no mandamos nada al respondent.
        //
        // Esta rama solo corre en Flujo 1 (1 paso). El Flujo 2 (multi-step
        // con firma de aprobación) queda cubierto más abajo — allí los
        // firmantes reciben aviso cuando el aprobador cierra el último
        // step, no cuando cada uno firma.
        const meRespondent = task.steps[stepIndex].respondents[respondentIndex];
        const hasPdfFormat = (dto.attachments?.length ?? 0) > 0;
        if (hasPdfFormat) {
          await this.sendRespondentPersonalEmail(
            task,
            meRespondent.email,
            meRespondent.name ?? meRespondent.email,
            dto.attachments ?? [],
          );
        }

        // Solo cuando el ÚLTIMO respondent cierra su copia → dispara UN
        // correo al CREADOR con el resumen. Nadie más lo recibe.
        if (isLastRespondent) {
          await this.sendCreatorSummaryEmail(task);
        }

        return { completed: true };
      }

      // ═════ FLUJO 2: multi-step ═══════════════════════════════════════
      // Si aún faltan respondents en este step, esperar (no avanzar, no
      // crear submissions todavía).
      const stillPending = task.steps[stepIndex].respondents.filter(
        (r) => r.status !== 'completed',
      );
      if (stillPending.length > 0) {
        task.markModified('steps');
        await task.save();
        return { completed: false, waitingCount: stillPending.length };
      }

      // Todos los respondents del step actual completaron.
      task.steps[stepIndex].status = 'completed';
      task.steps[stepIndex].completedAt = now;
    }

    const nextIndex = stepIndex + 1;
    const hasNext = nextIndex < task.steps.length;

    if (hasNext) {
      // Activar siguiente paso: TODOS sus respondents pasan a in_progress.
      task.steps[nextIndex].status = 'in_progress';
      const nextRespondents = task.steps[nextIndex].respondents ?? [];
      for (const r of nextRespondents) {
        if (r.status === 'pending') r.status = 'in_progress';
      }
      task.currentStepIndex = nextIndex;
      task.markModified('steps');
      await task.save();

      await this.sendStepEmail(task, nextIndex);

      return { completed: false, nextEmail: task.steps[nextIndex].recipientEmail };
    }

    // ═════ Último step del Flujo 2 (o tarea legacy monopaso) ══════════════
    task.status = 'completed';
    task.completedAt = new Date();

    const isMultiStep = task.steps.length > 1;

    if (isMultiStep) {
      // Multi-step: crear una submission por cada respondent del step 0
      // consolidando (prellenado + su formData step 0 + formData mergeado
      // de todos los steps posteriores). Esto genera N PDFs (uno por
      // firmante), cada uno con SU firma del step 0 + las firmas de todos
      // los steps siguientes (aprobadores) replicadas.
      const step0Respondents = this.getRespondents(task.steps[0]);
      task.markModified('steps');
      await task.save();

      for (const r0 of step0Respondents) {
        const finalDataForR = this.consolidateDataForRespondent(task, r0.email);
        try {
          await this.submissionsService.submit(
            task.formId,
            {
              data: finalDataForR,
              metadata: {
                source: 'task-email-multi-step',
                taskId: task._id,
                respondentEmail: r0.email,
              },
            },
            undefined,
            task._id,
          );
        } catch (err) {
          this.logger.error(
            `[submitStep] FALLO submission multi-step ${task._id} para ${r0.email}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            err instanceof Error ? err.stack : undefined,
          );
        }
        // Aviso al firmante del step 0 de que su PDF está listo.
        await this.sendStepZeroCompletedEmail(task, r0.email, r0.name ?? r0.email);
      }

      // Email al aprobador (último respondent que envió) con SU PDF.
      await this.sendCompletionEmail(task, dto.attachments ?? []);

      // Email de resumen al creador.
      await this.sendCreatorSummaryEmail(task);

      return { completed: true };
    }

    // ═════ Tarea legacy monopaso (1 step, 1 respondent) ═══════════════════
    const finalData = this.consolidateData(task);
    task.finalData = finalData;
    task.markModified('steps');
    await task.save();

    try {
      await this.submissionsService.submit(
        task.formId,
        {
          data: finalData,
          metadata: { source: 'task-email', taskId: task._id },
        },
        undefined,
        task._id,
      );
    } catch (err) {
      this.logger.error(
        `[submitStep] FALLO creando submission para tarea ${task._id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerErrorException(
        'No pudimos guardar tu envío. Por favor intenta de nuevo en unos segundos.',
      );
    }

    await this.sendCompletionEmail(task, dto.attachments ?? []);
    await this.sendCreatorSummaryEmail(task);

    return { completed: true };
  }

  /**
   * Consolida los datos para el PDF individual de un respondent del step 0
   * en Flujo 2 (multi-step). El resultado combina:
   *   - prellenado inicial
   *   - formData de ESE respondent en el step 0 (su firma/campos personales)
   *   - formData de todos los respondents de los steps 1..N (aprobadores)
   *
   * Los valores vacíos NO sobreescriben valores previos.
   */
  private consolidateDataForRespondent(
    task: TaskDocument,
    respondentEmail: string,
  ): Record<string, string> {
    const result: Record<string, string> = { ...task.prefilledData };

    // Datos del respondent en el step 0
    const step0Respondents = this.getRespondents(task.steps[0]);
    const myR = step0Respondents.find((r) => r.email === respondentEmail);
    if (myR) {
      for (const [k, v] of Object.entries(myR.formData ?? {})) {
        if (typeof v === 'string' && v.trim() === '') continue;
        result[k] = v;
      }
    }

    // Datos mergeados de todos los steps posteriores (aprobadores)
    for (let i = 1; i < task.steps.length; i++) {
      const rs = this.getRespondents(task.steps[i]);
      for (const r of rs) {
        for (const [k, v] of Object.entries(r.formData ?? {})) {
          if (typeof v === 'string' && v.trim() === '') continue;
          result[k] = v;
        }
      }
    }
    return result;
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

  /**
   * Tareas de un formulario con stats agregadas, para la pestaña Reportes.
   * Paginado: page arranca en 1, limit clampado a [1, 100] (default 20).
   */
  async listByForm(
    formId: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<TaskSummaryPageDto> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find({ formId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.taskModel.countDocuments({ formId }),
    ]);

    const data: TaskSummaryDto[] = tasks.map((t) => {
      const withMeta = t as unknown as { _id: string; createdAt?: Date };
      // Contamos personas, no pasos: un paso paralelo con 3 respondents
      // aporta 3 al total (para que "3/5 completaron" tenga sentido en la
      // vista de reportes cuando hay paralelos).
      let total = 0;
      let completed = 0;
      for (const s of t.steps) {
        const rs = this.getRespondents(s);
        total += rs.length;
        completed += rs.filter((r) => r.status === 'completed').length;
      }
      return {
        id: withMeta._id,
        title: t.title,
        status: t.status,
        createdAt: (withMeta.createdAt ?? new Date()).toISOString(),
        createdByName: t.createdByName,
        totalRecipients: total,
        completedCount: completed,
        pendingCount: total - completed,
        // Solo reportar "activo" si el token existe Y enabled=true. Tras un
        // submit de link oneShot, enabled queda en false pero el token
        // persiste — sin este check, la lista muestra "Enlace activo" para
        // links ya invalidados (inconsistente con el badge del detalle).
        hasShareLink: !!(t.shareLink?.token && t.shareLink?.enabled),
      };
    });

    return { data, total, page, limit };
  }

  /** Detalle de una tarea: destinatarios (con estado de reenvío) + submissions ligadas. */
  async getDetail(taskId: string): Promise<TaskDetailDto> {
    const task = await this.taskModel.findById(taskId).lean();
    if (!task) throw new NotFoundException('Tarea no encontrada');
    const withMeta = task as unknown as { _id: string; createdAt: Date };

    const now = Date.now();
    const TEN_MIN = 10 * 60 * 1000;
    // Aplanamos respondents: una fila por persona. Un paso paralelo con
    // 3 personas produce 3 filas con el mismo stepIndex — el frontend puede
    // agruparlas o mostrarlas como lista lineal.
    const recipients: TaskRecipientDto[] = task.steps.flatMap((s, i) => {
      const rs = this.getRespondents(s);
      const stepLastReminderMs = s.lastReminderAt ? s.lastReminderAt.getTime() : 0;
      return rs.map((r) => {
        const reminderMs = Math.max(
          stepLastReminderMs,
          r.lastReminderAt ? r.lastReminderAt.getTime() : 0,
        );
        return {
          stepIndex: i,
          email: r.email,
          name: r.name ?? r.email,
          status: r.status,
          submittedAt: r.completedAt ? r.completedAt.toISOString() : null,
          canResend:
            r.status !== 'completed' &&
            (!reminderMs || now - reminderMs > TEN_MIN),
          lastResendAt: reminderMs ? new Date(reminderMs).toISOString() : null,
        };
      });
    });

    // Submissions ligadas a esta tarea (flujo de enlace compartible; ver
    // submitFromShare más abajo, que persiste taskId en cada submission).
    const subs = await this.submissionsService.findByTaskId(taskId);
    const submissions: TaskSubmissionDto[] = subs.map((s) => {
      const meta = (s.metadata ?? {}) as {
        respondentEmail?: string;
        source?: string;
      };
      return {
        id: String(s._id),
        submittedAt: s.submittedAt.toISOString(),
        userName: s.submittedById != null ? `Usuario #${s.submittedById}` : 'Anónimo',
        hasPdf: !!s.templateSnapshot,
        summary: {},
        // Correo del respondent (si aplica) para que el frontend pueda
        // matchear submission → destinatario y mostrar su "nota" en la fila.
        respondentEmail: meta.respondentEmail,
        // Data cruda del formulario — el frontend lee los valores de los
        // widgets tipo quiz_score por su id para calcular notas/promedio.
        data: (s.data ?? {}) as Record<string, string>,
      };
    });

    // Widgets tipo "quiz_score" (Nota final) presentes en el snapshot del
    // formulario. El frontend usa esto para añadir columna Nota + promedio.
    const widgets = (task.widgets ?? []) as Array<{
      id?: string;
      type?: string;
      label?: string;
    }>;
    const scoreWidgets = widgets
      .filter((w) => w.type === 'quiz_score' && typeof w.id === 'string')
      .map((w) => ({ id: w.id as string, label: w.label || 'Nota' }));

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
      shareLinkOneShot: task.shareLink?.oneShot === true,
      recipients,
      submissions,
      externalCount,
      scoreWidgets,
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
    // Throttle a nivel step: si el envío más reciente de CUALQUIER
    // respondent fue hace <10 min, forzamos esperar. Cubre paralelos.
    const respondents = this.getRespondents(step);
    const lastReminderMs = Math.max(
      step.lastReminderAt ? step.lastReminderAt.getTime() : 0,
      ...respondents.map((r) => (r.lastReminderAt ? r.lastReminderAt.getTime() : 0)),
    );
    if (lastReminderMs && now.getTime() - lastReminderMs < TEN_MIN) {
      const restante = Math.ceil(
        (TEN_MIN - (now.getTime() - lastReminderMs)) / 60_000,
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
    // Además marcar lastReminderAt de cada respondent pendiente para que el
    // throttle paralelo se registre por-email también.
    if (step.respondents && step.respondents.length > 0) {
      for (const r of step.respondents) {
        if (r.status !== 'completed') r.lastReminderAt = now;
      }
    }
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
        $or: [
          { 'steps.recipientEmail': lower },
          { 'steps.respondents.email': lower },
        ],
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
      // Un step "me contiene" si mi email está entre sus respondents
      // (paralelo nuevo) o en su recipientEmail legacy. Además, dentro de un
      // step paralelo mi status depende de MI respondent, no del step entero.
      type MyStepInfo = {
        step: (typeof task.steps)[number];
        respondentStatus: 'pending' | 'in_progress' | 'completed';
        myToken: string;
      };
      const mySteps: MyStepInfo[] = [];
      for (const s of task.steps) {
        const respondents = this.getRespondents(s);
        const mine = respondents.find((r) => r.email === lower);
        if (!mine) continue;
        mySteps.push({
          step: s,
          respondentStatus: mine.status,
          myToken: mine.token,
        });
      }
      if (mySteps.length === 0) continue;

      // Elegimos el "paso más relevante" del usuario en esta tarea:
      // primero in_progress, luego pending, y como último recurso un
      // completed (significa que ya terminó su parte y queda esperando).
      const inProgress = mySteps.find((m) => m.respondentStatus === 'in_progress');
      const pending = mySteps.find((m) => m.respondentStatus === 'pending');
      const completed = mySteps.find((m) => m.respondentStatus === 'completed');
      const myInfo = inProgress ?? pending ?? completed;
      if (!myInfo) continue;

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
        myStepOrder: myInfo.step.order,
        totalSteps: task.steps.length,
        currentStepOrder: currentStep?.order ?? myInfo.step.order,
        myStatus,
        // Token solo si es mi turno — los demás casos no deben poder abrir el form.
        token: myStatus === 'in_progress' ? myInfo.myToken : '',
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
    oneShot?: boolean,
  ): Promise<{ shareLinkUrl: string | null }> {
    const task = await this.taskModel.findById(taskId);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.createdById !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    if (enabled) {
      // Idempotente: si ya hay link con enabled=true, no rotar el token.
      if (task.shareLink?.enabled) {
        // Solo tocamos oneShot si vino explícito en el body; sino no-op.
        if (oneShot !== undefined) {
          task.shareLink.oneShot = oneShot;
          await task.save();
        }
      } else {
        task.shareLink = {
          token: randomBytes(8).toString('base64url'),
          enabled: true,
          oneShot: oneShot === true,
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

  async cancel(id: string, userId: number, userRole?: string): Promise<Task> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    // Admin override: cualquier admin puede eliminar tareas de todo el equipo
    // desde el panel de Reportes. Coordinator/user siguen restringidos al owner.
    const isAdmin = userRole === 'admin';
    if (!isAdmin && task.createdById !== userId) {
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
    if (!widgetId) return { results: [] };

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

    // El form fuente (config.sourceFormId) puede ser distinto al form de la
    // tarea. Debe pasar los mismos checks de acceso público: activo,
    // isPublic=true, sin requiresEmailVerification. Sin este assertion, un
    // admin que marca privado el form fuente después de publicar la tarea
    // sigue exponiendo esos submissions por el endpoint anónimo del share.
    await this.assertShareFormOpen(config.sourceFormId);

    const fields = Array.isArray(config.searchableFields)
      ? config.searchableFields
      : [];
    return this.submissionsService.searchSubmissions(
      config.sourceFormId,
      query,
      fields,
      query ? 20 : 50,
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
    //
    // Los campos descartados NO se pierden: quedan en `_unknownFields`
    // dentro del mismo doc para que Sara pueda revisarlos si el snapshot
    // quedó desfasado del form vivo (política "nada se pierde").
    const validWidgetIds = new Set(
      (task.widgets ?? [])
        .map((w) => (w as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string'),
    );
    const filteredData: Record<string, unknown> = {};
    const unknownFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (validWidgetIds.has(key)) filteredData[key] = value;
      else unknownFields[key] = value;
    }
    if (Object.keys(unknownFields).length > 0) {
      filteredData._unknownFields = unknownFields;
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

    // Enlace de un solo uso: tras el primer submit exitoso, se desactiva.
    // `task` viene de un .lean() (arriba), así que no tiene .save(); usamos
    // updateOne directo sobre el filtro por _id.
    if (task.shareLink?.oneShot) {
      await this.taskModel.updateOne(
        { _id: task._id },
        { $set: { 'shareLink.enabled': false } },
      );
    }

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
    const totalSteps = task.steps.length;
    const respondents = this.getRespondents(step);
    // Solo envíamos a los que aún no diligenciaron. Ejemplo: cron de
    // recordatorio o /resend re-manda a los pendientes sin molestar a los
    // que ya completaron su parte del paso paralelo.
    const targets = respondents.filter((r) => r.status !== 'completed');
    if (targets.length === 0) return true;

    const parallelHint =
      respondents.length > 1
        ? `<p style="margin:8px 0 0;font-size:12px;color:#0891b2;">🔁 Este paso lo deben diligenciar <strong>${respondents.length} personas</strong> en paralelo. El paso solo avanza cuando todas hayan diligenciado.</p>`
        : '';

    const results = await Promise.all(
      targets.map(async (r) => {
        const taskUrl = this.getTaskUrl(r.token);
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00c2a8,#0891b2);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">📋 Tarea pendiente de completar</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>Hola ${r.name || r.email},</p>
      <p>${isFirst ? `<strong>${task.createdByName}</strong> te ha asignado una tarea para completar el formulario:` : `El paso anterior ha sido completado. Ahora es tu turno para continuar con el formulario:`}</p>
      <div style="background:#f8fafc;border-left:4px solid #00c2a8;padding:14px;border-radius:0 8px 8px 0;margin:16px 0;">
        <strong style="color:#111827;">${task.title}</strong>
        ${task.description ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${task.description}</p>` : ''}
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Formulario: ${task.formName} · Paso ${stepIndex + 1} de ${totalSteps}</p>
        ${parallelHint}
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
            toRecipients: [{ type: 'static', email: r.email }],
            senderName: 'SoulForms — Tareas',
          });
          return true;
        } catch (err) {
          console.error(
            `[TasksService] Error enviando email paso ${stepIndex} a ${r.email}:`,
            err,
          );
          return false;
        }
      }),
    );
    // Éxito si al menos uno se envió (el resto se cubre por recordatorios /
    // reintento manual). Nunca fallamos el envío entero por un email caído.
    return results.some(Boolean);
  }

  /**
   * Email personal al respondent (Flujo 1) con SU PDF adjunto. Se dispara
   * SOLO si el formulario tiene formato PDF configurado (el cliente ya
   * generó el PDF y lo mandó como attachment). Va solo a este respondent
   * — no al template global ni al creador (esos van al final de la tarea).
   */
  private async sendRespondentPersonalEmail(
    task: TaskDocument,
    email: string,
    name: string,
    attachments: EmailAttachment[],
  ): Promise<void> {
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">✅ Recibimos tu formulario</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>Hola ${name || email},</p>
      <p>Tu envío del formulario <strong>${task.formName}</strong> — <strong>${task.title}</strong> quedó registrado. Adjunto encontrarás la copia en PDF de tu registro.</p>
    </div>
  </div>
</body></html>`;
    try {
      await this.emailService.sendEmail({
        subject: `✅ Recibido: ${task.title}`,
        emailBody: html,
        toRecipients: [{ type: 'static', email }],
        senderName: 'SoulForms — Tareas',
        attachments,
      });
    } catch (err) {
      this.logger.error(
        `[sendRespondentPersonalEmail] Error a ${email}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Aviso a un firmante del step 0 (Flujo 2) de que su PDF individual ya
   * fue generado y está disponible para descarga desde el reporte de la
   * tarea. No attach el PDF: el backend no lo re-renderiza aquí; el
   * respondent lo descarga cuando el creador lo comparte o desde el
   * enlace del panel de reportes.
   */
  private async sendStepZeroCompletedEmail(
    task: TaskDocument,
    email: string,
    name: string,
  ): Promise<void> {
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">✅ Tu documento fue firmado y aprobado</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>Hola ${name || email},</p>
      <p>El aprobador ha firmado la tarea <strong>${task.title}</strong> del formulario <strong>${task.formName}</strong>. Tu documento ya está listo con todas las firmas.</p>
      <p style="font-size:12px;color:#9ca3af;">Si necesitas una copia del PDF, contacta al creador de la tarea (${task.createdByName}).</p>
    </div>
  </div>
</body></html>`;
    try {
      await this.emailService.sendEmail({
        subject: `✅ Aprobado: ${task.title}`,
        emailBody: html,
        toRecipients: [{ type: 'static', email }],
        senderName: 'SoulForms — Tareas',
      });
    } catch (err) {
      this.logger.error(
        `[sendStepZeroCompletedEmail] Error avisando a ${email}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Email de resumen al CREADOR de la tarea cuando ésta se completa
   * (todos los respondents del último step terminaron). Incluye la lista
   * de destinatarios con su estado, y si el formulario tiene widgets
   * "quiz_score" (Nota final), incluye la nota de cada respondent + el
   * promedio general.
   */
  private async sendCreatorSummaryEmail(task: TaskDocument): Promise<void> {
    // Resolver email del creador. Si el usuario ya no existe (soft-deleted),
    // no mandamos nada — no vale la pena fallar por eso.
    const creator = await this.usersService.findById(task.createdById);
    if (!creator?.email) return;

    // Detectar widgets tipo "quiz_score" en el snapshot del formulario.
    const widgets = (task.widgets ?? []) as Array<{
      id?: string;
      type?: string;
      label?: string;
    }>;
    const scoreWidgets = widgets
      .filter((w) => w.type === 'quiz_score' && typeof w.id === 'string')
      .map((w) => ({ id: w.id as string, label: w.label || 'Nota' }));

    // Buscar submissions ligadas a la tarea (una por respondent en flujos
    // paralelos). Para leer la "nota" de cada uno, usamos submission.data.
    const submissions = await this.submissionsService.findByTaskId(task._id);
    const submissionByEmail = new Map<string, { data: Record<string, unknown> }>();
    for (const s of submissions) {
      const email = (s.metadata as { respondentEmail?: string } | null | undefined)
        ?.respondentEmail;
      if (email) {
        submissionByEmail.set(email, { data: (s.data ?? {}) as Record<string, unknown> });
      }
    }

    // Construir filas para la tabla de resumen (una por respondent del step 0
    // en Flujo 2 o del step único en Flujo 1).
    const relevantStepIndex = task.steps.length > 1 ? 0 : 0;
    const respondents = this.getRespondents(task.steps[relevantStepIndex]);

    type Row = { name: string; email: string; scores: (string | null)[] };
    const rows: Row[] = respondents.map((r) => {
      const sub = submissionByEmail.get(r.email);
      const scores = scoreWidgets.map((w) => {
        const raw = sub?.data?.[w.id];
        return raw == null || raw === '' ? null : String(raw);
      });
      return { name: r.name || r.email, email: r.email, scores };
    });

    // Promedio por widget de nota (ignora filas sin valor numérico)
    const averages = scoreWidgets.map((_, idx) => {
      const nums: number[] = [];
      for (const row of rows) {
        const raw = row.scores[idx];
        if (raw == null) continue;
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) nums.push(n);
      }
      if (nums.length === 0) return null;
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return avg.toFixed(2);
    });

    const scoreCols = scoreWidgets
      .map((w) => `<th style="text-align:right;padding:6px 10px;">${w.label}</th>`)
      .join('');
    const rowsHtml = rows
      .map(
        (r) => `<tr>
          <td style="padding:6px 10px;">${r.name}</td>
          <td style="padding:6px 10px;color:#6b7280;">${r.email}</td>
          ${r.scores
            .map(
              (s) =>
                `<td style="text-align:right;padding:6px 10px;font-weight:600;">${
                  s == null ? '—' : s
                }</td>`,
            )
            .join('')}
        </tr>`,
      )
      .join('');

    const avgRow =
      scoreWidgets.length > 0
        ? `<tr style="border-top:2px solid #e5e7eb;background:#f9fafb;">
             <td colspan="2" style="padding:8px 10px;font-weight:700;">Promedio</td>
             ${averages
               .map(
                 (a) =>
                   `<td style="text-align:right;padding:8px 10px;font-weight:700;color:#0891b2;">${
                     a ?? '—'
                   }</td>`,
               )
               .join('')}
           </tr>`
        : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:20px;">✅ Tu tarea fue completada</h1>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      <p>Hola ${creator.name || creator.email},</p>
      <p>La tarea <strong>${task.title}</strong> del formulario <strong>${task.formName}</strong> fue completada por <strong>${respondents.length}</strong> persona${respondents.length === 1 ? '' : 's'}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
        <thead>
          <tr style="background:#f1f5f9;color:#374151;">
            <th style="text-align:left;padding:8px 10px;">Nombre</th>
            <th style="text-align:left;padding:8px 10px;">Correo</th>
            ${scoreCols}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${avgRow}
        </tbody>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#9ca3af;">Puedes ver el detalle completo en la pestaña Reportes de la tarea.</p>
    </div>
  </div>
</body></html>`;

    try {
      await this.emailService.sendEmail({
        subject: `✅ Tarea completada: ${task.title}`,
        emailBody: html,
        toRecipients: [{ type: 'static', email: creator.email }],
        senderName: 'SoulForms — Tareas',
      });
    } catch (err) {
      this.logger.error(
        `[sendCreatorSummaryEmail] Error avisando al creador ${creator.email}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async sendCompletionEmail(
    task: TaskDocument,
    attachments: Array<EmailAttachment & { templateId?: string }>,
  ): Promise<void> {
    type Tpl = Record<string, unknown> & {
      id?: string;
      enabled?: boolean;
      subject?: string;
      emailBody?: string;
      senderName?: string;
      replyTo?: string;
      toRecipients?: EmailRecipient[];
      ccRecipients?: EmailRecipient[];
      bccRecipients?: EmailRecipient[];
    };

    // Fuente de verdad: array nuevo. Fallback: singular legacy.
    const arr =
      (task as unknown as { emailTemplates?: Tpl[] }).emailTemplates ?? [];
    const singular = (task.emailTemplate ?? null) as Tpl | null;
    const rawTemplates: Tpl[] = arr.length > 0 ? arr : singular ? [singular] : [];
    const enabledTemplates = rawTemplates.filter((t) => t.enabled === true);

    const finalData = task.finalData ?? {};

    // Si hay al menos una config habilitada, disparamos UN email por cada
    // una (cada una con sus propios destinatarios, cuerpo, asunto y PDF).
    // Si no hay ninguna, caemos al email simple a todos los participantes.
    if (enabledTemplates.length > 0) {
      const placeholders = this.buildLabeledData(task, finalData);

      // Si el cliente mandó attachments taggeados por templateId, cada
      // template usa SU set. Los sin templateId se adjuntan a TODOS como
      // compat para clientes viejos (single-template).
      const sharedAttachments = attachments.filter((a) => !a.templateId);

      for (const template of enabledTemplates) {
        const subject = this.renderPlaceholders(
          template.subject || `✅ Completada: ${task.title}`,
          placeholders,
        );
        const body = this.renderPlaceholders(template.emailBody || '', placeholders);

        const ownAttachments = template.id
          ? attachments.filter((a) => a.templateId === template.id)
          : [];
        const toSend =
          ownAttachments.length > 0
            ? [...ownAttachments, ...sharedAttachments]
            : sharedAttachments;

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
            attachments: toSend,
          });
        } catch (err) {
          console.error(
            `[TasksService] Error enviando email de completado (template "${template.id ?? 'legacy'}"):`,
            err,
          );
        }
      }
      return;
    }

    // Fallback: notificación simple a todos los participantes (incluye a
    // todos los respondents paralelos de cada paso, no solo al primero).
    const allEmails = task.steps.flatMap((s) =>
      this.getRespondents(s).map((r) => r.email),
    );
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
  //
  // Desambiguación por sufijo: si dos widgets tienen el mismo label (ej. dos
  // "Cargo") la primera aparición queda como `cargo` y las siguientes como
  // `cargo1`, `cargo2`, etc. Debe espejar EXACTAMENTE la lógica de
  // src/utils/placeholders.ts del frontend (`uniqueBaseKey`) para que el
  // mapper del PDF y este backend produzcan las mismas keys.
  private buildLabeledData(
    task: Task,
    finalData: Record<string, string>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    const widgets = (task.widgets ?? []) as Array<{
      id: string;
      label: string;
      placeholder?: string;
    }>;
    const normalize = (s: string) =>
      (s || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
    const used = new Map<string, number>();
    for (const w of widgets) {
      // Si el admin definió un placeholder manual en el widget, lo usamos;
      // si no, caemos a normalize(label) con sufijo numérico para evitar
      // colisiones entre widgets con el mismo label.
      const manual = (w.placeholder ?? '').trim();
      const rawKey = manual ? normalize(manual) : normalize(w.label);
      if (!rawKey) continue;
      const current = used.get(rawKey) ?? 0;
      used.set(rawKey, current + 1);
      const key = current === 0 ? rawKey : `${rawKey}${current}`;
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