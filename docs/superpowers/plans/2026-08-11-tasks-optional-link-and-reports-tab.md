# Tareas: link opcional + pestaña Reportes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implementar (1) creación de tareas sin obligar el link (endpoint PATCH para agregar/quitar a posteriori) y (2) nueva pestaña "Tareas" en `/reports` con detalle inline, reenvío manual, recordatorios automáticos cron 9AM/3PM y descarga masiva de PDFs.

**Architecture:** Backend NestJS con nuevos endpoints REST + cron `@nestjs/schedule`. Frontend refactor de `CreateTaskModal` + nuevo componente `TasksReportPanel` en `ReportsPage`, reusando `SubmissionsListView` extraído desde `RecordsTable`.

**Tech Stack:** NestJS 11 + Mongoose 9 + `@nestjs/schedule` (verificar/instalar) + React 19 + TypeScript estricto + Tailwind. Sin nuevas dependencias además de schedule.

## Global Constraints

- **Backward compat**: endpoints existentes de tasks (`POST /tasks`, `POST /tasks/:id/send`, `PATCH /tasks/:id/cancel`, `GET /tasks/share/:token`) NO se tocan.
- **Ownership**: endpoints que mutan (`share-link`, `resend`) requieren `createdById === req.user.id` O rol `ADMIN`. Endpoints de lectura (`GET`) requieren `REPORTS_VIEW` (rol ADMIN por default).
- **Rate limiting**: `resend` throttled 1× cada 10 min por (taskId, stepIndex). `bulk-pdf` throttled 1× por minuto.
- **NO `git add -A`** — commit explícito por archivo.
- **NO commits con emojis** salvo que el archivo existente ya use consistentemente.
- **Copy en español** para toda UI nueva.
- **Cron horario**: `@Cron('0 9,15 * * *')` — 9AM y 3PM diarios. Skip si `step.lastReminderAt < 5h`. Sin cap de días.
- **Reusos**: `sendStepEmail(task, stepIndex)` del `TasksService`, `BulkPdfService`, `usePdfPreview` hook.

---

### Task 1: Backend — schema `lastReminderAt` + endpoint `POST /tasks/:id/share-link`

**Files:**
- Modify: `backend/src/tasks/task.schema.ts` (agregar `lastReminderAt` a TaskStep)
- Modify: `backend/src/tasks/tasks.service.ts` (nuevo método `toggleShareLink`)
- Modify: `backend/src/tasks/tasks.controller.ts` (nuevo endpoint)
- Create: `backend/src/tasks/tasks-share-link.service.spec.ts` (2-3 tests)

**Interfaces:**
- Consumes: `APP_BASE_URL` env var (ya usada por otros endpoints de tasks).
- Produces: método `toggleShareLink(taskId, enabled, userId): Promise<{shareLinkUrl: string | null}>`.

- [ ] **Step 1: Agregar `lastReminderAt` al step**

En `backend/src/tasks/task.schema.ts`, dentro de la clase `TaskStep`:

```ts
@Prop({ type: Date, default: null })
lastReminderAt: Date | null;
```

Backward compat automática (default null en docs viejos al leer).

- [ ] **Step 2: Método `toggleShareLink` en tasks.service.ts**

```ts
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
```

Importar `randomBytes` de `node:crypto` (ya usado en `create()`).

- [ ] **Step 3: Endpoint en tasks.controller.ts**

```ts
@UseGuards(JwtAuthGuard)
@Post(':id/share-link')
async toggleShareLink(
  @Param('id') id: string,
  @Body() body: { enabled: boolean },
  @Req() req: AuthedRequest,
) {
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuario no autenticado');
  return this.tasksService.toggleShareLink(id, body.enabled === true, Number(user.id));
}
```

- [ ] **Step 4: Tests jest**

Crear `backend/src/tasks/tasks-share-link.service.spec.ts`:

```ts
describe('TasksService.toggleShareLink', () => {
  it('genera token cuando enabled=true y no existe', async () => {...});
  it('idempotente: dos llamadas con enabled=true no rotan el token', async () => {...});
  it('enabled=false pone shareLink=null', async () => {...});
  it('rechaza 403 si createdById !== userId', async () => {...});
  it('rechaza 404 si task no existe', async () => {...});
});
```

Usar `getModelToken(Task.name)` mock. Patrón como `assignments-tree.service.spec.ts`.

- [ ] **Step 5: Build y tests**

```bash
cd backend
npx jest src/tasks/tasks-share-link.service.spec.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/task.schema.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks-share-link.service.spec.ts
git commit -m "feat(tasks): endpoint POST /tasks/:id/share-link + schema lastReminderAt"
```

---

### Task 2: Backend — endpoints `GET /forms/:formId/tasks` + `GET /tasks/:id/detail`

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts` (2 nuevos métodos)
- Modify: `backend/src/tasks/tasks.controller.ts` (2 nuevos endpoints)
- Modify: `backend/src/forms/forms.controller.ts` o `tasks.controller.ts` (para el `GET /forms/:formId/tasks`)
- Create: `backend/src/tasks/tasks-list.service.spec.ts` (3-4 tests)

**Interfaces:**
- Consumes: `Task` schema del Task 1 (ya con `lastReminderAt`).
- Produces:
  - `listByForm(formId, userId): Promise<TaskSummary[]>` — con stats.
  - `getDetail(taskId, userId): Promise<TaskDetail>` — con recipients + submissions.
- Reusa `FormSubmission` model para obtener submissions (grep `FormSubmission` en el proyecto).

- [ ] **Step 1: Definir tipos DTO**

En `backend/src/tasks/tasks.dto.ts` o nuevo file `backend/src/tasks/tasks-list.dto.ts`:

```ts
export type TaskSummaryDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  totalRecipients: number;
  completedCount: number;
  pendingCount: number;
  hasShareLink: boolean;
};

export type TaskRecipientDto = {
  stepIndex: number;
  email: string;
  name: string;
  status: 'in_progress' | 'pending' | 'completed';
  submittedAt: string | null;
  canResend: boolean;
  lastResendAt: string | null;
};

export type TaskSubmissionDto = {
  id: string;
  submittedAt: string;
  userName: string;
  hasPdf: boolean;
  summary: Record<string, string>;
};

export type TaskDetailDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  shareLinkUrl: string | null;
  recipients: TaskRecipientDto[];
  submissions: TaskSubmissionDto[];
};
```

- [ ] **Step 2: Método `listByForm(formId)` en tasks.service.ts**

```ts
async listByForm(formId: string): Promise<TaskSummaryDto[]> {
  const tasks = await this.taskModel
    .find({ formId })
    .sort({ createdAt: -1 })
    .lean();

  const baseUrl = process.env.APP_BASE_URL ?? '';
  return tasks.map((t) => ({
    id: t._id,
    title: t.title,
    status: t.status,
    createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
    createdByName: t.createdByName,
    totalRecipients: t.steps.length,
    completedCount: t.steps.filter((s) => s.status === 'completed').length,
    pendingCount: t.steps.filter((s) => s.status !== 'completed').length,
    hasShareLink: !!t.shareLink?.token,
  }));
}
```

- [ ] **Step 3: Método `getDetail(taskId)` en tasks.service.ts**

```ts
async getDetail(taskId: string): Promise<TaskDetailDto> {
  const task = await this.taskModel.findById(taskId).lean();
  if (!task) throw new NotFoundException('Tarea no encontrada');

  const now = Date.now();
  const TEN_MIN = 10 * 60 * 1000;
  const recipients: TaskRecipientDto[] = task.steps.map((s, i) => ({
    stepIndex: i,
    email: s.recipientEmail,
    name: s.recipientName,
    status: s.status,
    submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    canResend:
      s.status !== 'completed' &&
      (!s.lastReminderAt || now - s.lastReminderAt.getTime() > TEN_MIN),
    lastResendAt: s.lastReminderAt ? s.lastReminderAt.toISOString() : null,
  }));

  // Submissions ligadas a esta tarea: FormSubmission tiene taskId? Verificar
  // en form-submission.schema.ts. Si no existe el campo, se agrega en el
  // Step 4 abajo antes de continuar.
  const submissionModel = ... // inyectar FormSubmissionModel via constructor
  const subs = await submissionModel
    .find({ taskId })
    .sort({ submittedAt: -1 })
    .lean();

  const submissions: TaskSubmissionDto[] = subs.map((s) => ({
    id: s._id,
    submittedAt: s.submittedAt.toISOString(),
    userName: s.userName ?? 'Anónimo',
    hasPdf: !!s.templateSnapshot,
    summary: {}, // ver Task 6 para poblar; MVP puede dejarlo vacío
  }));

  const baseUrl = process.env.APP_BASE_URL ?? '';
  const shareLinkUrl = task.shareLink?.token
    ? `${baseUrl}/t/${task.shareLink.token}`
    : null;

  return {
    id: task._id,
    title: task.title,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    createdByName: task.createdByName,
    shareLinkUrl,
    recipients,
    submissions,
  };
}
```

- [ ] **Step 4: Verificar/agregar `taskId` a FormSubmission**

Grep `taskId` en `backend/src/submissions/form-submission.schema.ts`. Si existe, saltar este step. Si NO existe:

```ts
@Prop({ type: String, default: null, index: true })
taskId: string | null;
```

Y en el flujo actual `POST /tasks/share/:token/submit` (o el análogo para step submission), guardar `taskId` cuando se crea el submission. Verificar `backend/src/tasks/tasks.controller.ts` o `submissions.service.ts` para localizar el submit y agregar el campo.

- [ ] **Step 5: Endpoints en tasks.controller.ts**

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.REPORTS_VIEW)
@Get('by-form/:formId')
async listByForm(@Param('formId') formId: string) {
  return this.tasksService.listByForm(formId);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.REPORTS_VIEW)
@Get(':id/detail')
async getDetail(@Param('id') id: string) {
  return this.tasksService.getDetail(id);
}
```

Alternativa para `GET /forms/:formId/tasks` (mejor URL): registrarlo en `forms.controller.ts` que ya tiene el prefix `/forms`. Ambas ubicaciones son válidas — decidir por consistencia con el resto del proyecto (verificar dónde vive `GET /forms/:formId/records`).

- [ ] **Step 6: Tests**

`backend/src/tasks/tasks-list.service.spec.ts`:

```ts
describe('TasksService.listByForm', () => {
  it('devuelve stats correctas (total, completed, pending)', ...);
  it('sort por createdAt desc', ...);
  it('vacío si no hay tareas', ...);
});
describe('TasksService.getDetail', () => {
  it('canResend=false si status completed', ...);
  it('canResend=false si lastReminderAt <10min', ...);
  it('shareLinkUrl correcto si hay shareLink', ...);
});
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks-list.dto.ts backend/src/tasks/tasks-list.service.spec.ts
# + form-submission.schema.ts si se modificó
# + forms.controller.ts si se agregó ahí
git commit -m "feat(tasks): endpoints GET listByForm + GET detail para pestana Reportes"
```

---

### Task 3: Backend — endpoints `POST /tasks/:id/steps/:stepIndex/resend` + `POST /tasks/:id/bulk-pdf`

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts` (nuevo método `resendStep`)
- Modify: `backend/src/tasks/tasks.controller.ts` (2 nuevos endpoints)
- Modify: `backend/src/submissions/bulk-pdf.service.ts` (aceptar filtro por taskId; opcional)
- Create: `backend/src/tasks/tasks-resend.service.spec.ts` (2-3 tests)

**Interfaces:**
- Consumes: `sendStepEmail(task, stepIndex)` existente en TasksService.
- Consumes: `BulkPdfService.request()` existente en submissions.
- Produces:
  - `resendStep(taskId, stepIndex, userId): Promise<{ok, sentAt}>`
  - Endpoint `POST /tasks/:id/bulk-pdf` que reusa `BulkPdfService`.

- [ ] **Step 1: Método `resendStep` en tasks.service.ts**

```ts
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
  if (step.lastReminderAt && now.getTime() - step.lastReminderAt.getTime() < TEN_MIN) {
    const restante = Math.ceil((TEN_MIN - (now.getTime() - step.lastReminderAt.getTime())) / 60_000);
    throw new HttpException(
      `Espera ${restante} min para reenviar de nuevo`,
      429,
    );
  }

  await this.sendStepEmail(task, stepIndex);
  step.lastReminderAt = now;
  task.markModified('steps');
  await task.save();
  return { ok: true, sentAt: now.toISOString() };
}
```

Importar `HttpException` de `@nestjs/common`.

- [ ] **Step 2: Endpoint resend en tasks.controller.ts**

```ts
@UseGuards(JwtAuthGuard)
@Post(':id/steps/:stepIndex/resend')
@Throttle({ default: { limit: 1, ttl: 600_000 } })   // 1 vez cada 10 min por IP
async resendStep(
  @Param('id') id: string,
  @Param('stepIndex', ParseIntPipe) stepIndex: number,
  @Req() req: AuthedRequest,
) {
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuario no autenticado');
  return this.tasksService.resendStep(id, stepIndex, Number(user.id));
}
```

- [ ] **Step 3: Endpoint bulk-pdf en tasks.controller.ts**

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.REPORTS_VIEW)
@Post(':id/bulk-pdf')
@Throttle({ default: { limit: 1, ttl: 60_000 } })
@HttpCode(202)
async bulkPdf(
  @Param('id') id: string,
  @Req() req: AuthedRequest,
): Promise<{ ok: true; message: string }> {
  const task = await this.tasksService.findOne(id);
  if (!task) throw new NotFoundException('Tarea no encontrada');
  const user = req.user!;
  const actor = { name: user.email ?? `user${user.id}`, role: user.role };

  // Fire-and-forget. BulkPdfService actual acepta formId + filtros.
  // Extender su método `request` para aceptar { taskId } filter (Step 4),
  // o alternativa: hacer un query custom aquí sin extender el service.
  void this.bulkPdf
    .request(task.formId, Number(user.id), { taskId: id }, req.ip ?? null, actor)
    .catch((err) => this.logger.error('bulk-pdf task error', err));

  return {
    ok: true,
    message: 'Estamos generando y enviándote los PDFs por correo.',
  };
}
```

Inyectar `BulkPdfService` en el controller. Verificar imports.

- [ ] **Step 4: Extender BulkPdfService para filtro por taskId**

En `backend/src/submissions/bulk-pdf.service.ts`, extender el shape del filtro `{from, to, q}` a `{from, to, q, taskId}`. En la query interna que arma la lista de submissions, agregar:

```ts
if (filters.taskId) query.taskId = filters.taskId;
```

Verificar que `FormSubmission` tenga campo `taskId` (agregado en Task 2 Step 4 si faltaba).

- [ ] **Step 5: Tests**

`backend/src/tasks/tasks-resend.service.spec.ts`:

```ts
describe('TasksService.resendStep', () => {
  it('reenvía y actualiza lastReminderAt', ...);
  it('rechaza 429 si lastReminderAt <10min', ...);
  it('rechaza 400 si step completed', ...);
  it('rechaza 403 si no owner', ...);
});
```

Mockear `sendStepEmail` con `jest.spyOn`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks-resend.service.spec.ts backend/src/submissions/bulk-pdf.service.ts
git commit -m "feat(tasks): endpoints resend step + bulk-pdf por tarea con throttle"
```

---

### Task 4: Backend — cron recordatorios 9AM/3PM con `@nestjs/schedule`

**Files:**
- Modify: `backend/package.json` (agregar `@nestjs/schedule` si falta)
- Modify: `backend/src/app.module.ts` (importar `ScheduleModule.forRoot()`)
- Create: `backend/src/tasks/tasks-reminders.service.ts`
- Modify: `backend/src/tasks/tasks.module.ts` (registrar el nuevo service)
- Create: `backend/src/tasks/tasks-reminders.service.spec.ts` (2-3 tests)

**Interfaces:**
- Consumes: `TasksService.sendStepEmail(task, stepIndex)`.
- Produces: cron que dispara a las 9:00 AM y 3:00 PM.

- [ ] **Step 1: Instalar `@nestjs/schedule` si falta**

Verificar:
```bash
grep "@nestjs/schedule" backend/package.json
```

Si no está:
```bash
cd backend
npm install @nestjs/schedule
```

- [ ] **Step 2: Registrar en app.module.ts**

Agregar import y `ScheduleModule.forRoot()` al array de imports:

```ts
import { ScheduleModule } from '@nestjs/schedule';
// ...
@Module({
  imports: [
    // ... otros
    ScheduleModule.forRoot(),
    TasksModule,
  ],
})
```

- [ ] **Step 3: Crear `tasks-reminders.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from './task.schema';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksRemindersService {
  private readonly logger = new Logger(TasksRemindersService.name);
  private readonly FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly tasksService: TasksService,
  ) {}

  @Cron('0 9,15 * * *')   // 9:00 AM y 3:00 PM diarios
  async sendReminders(): Promise<void> {
    this.logger.log('Cron recordatorios de tareas — inicio');
    const now = Date.now();

    // Tareas in_progress con al menos un step in_progress.
    const tasks = await this.taskModel.find({
      status: 'in_progress',
      'steps.status': 'in_progress',
    });

    let sent = 0;
    let skipped = 0;
    for (const task of tasks) {
      const idx = task.steps.findIndex((s) => s.status === 'in_progress');
      if (idx < 0) continue;
      const step = task.steps[idx];

      // Skip si el ultimo recordatorio fue hace <5h (para deduplicar retries
      // de cron o horarios cercanos como 9AM + retry a 10AM).
      if (step.lastReminderAt && now - step.lastReminderAt.getTime() < this.FIVE_HOURS_MS) {
        skipped++;
        continue;
      }

      try {
        await this.tasksService.sendStepEmail(task, idx);
        step.lastReminderAt = new Date(now);
        task.markModified('steps');
        await task.save();
        sent++;
      } catch (err) {
        this.logger.error(
          `Recordatorio task=${task._id} step=${idx} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(`Cron recordatorios — enviados=${sent} salteados=${skipped}`);
  }
}
```

Nota: si `sendStepEmail` está marcado `private` en `TasksService`, cambiar a `public` (o crear un método público wrapper).

- [ ] **Step 4: Wireup en tasks.module.ts**

Agregar `TasksRemindersService` a `providers`. Verificar que `providers` incluya `TasksService`.

- [ ] **Step 5: Test**

`backend/src/tasks/tasks-reminders.service.spec.ts`:

```ts
describe('TasksRemindersService', () => {
  it('envía recordatorio a step in_progress sin lastReminderAt', ...);
  it('salta step con lastReminderAt <5h', ...);
  it('actualiza lastReminderAt solo si el envio fue exitoso', ...);
});
```

Mockear `TasksService.sendStepEmail`.

- [ ] **Step 6: Build + tests**

```bash
cd backend
npx jest src/tasks/tasks-reminders.service.spec.ts
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/tasks-reminders.service.ts backend/src/tasks/tasks-reminders.service.spec.ts backend/src/tasks/tasks.module.ts backend/src/app.module.ts backend/package.json backend/package-lock.json
git commit -m "feat(tasks): cron recordatorios 9AM y 3PM con skip 5h"
```

---

### Task 5: Frontend — refactor `CreateTaskModal.tsx` para link opcional

**Files:**
- Modify: `src/services/api.ts` (nuevo helper `toggleTaskShareLinkApi`)
- Modify: `src/components/home/CreateTaskModal.tsx`

**Interfaces:**
- Consumes: `POST /tasks/:id/share-link` del Task 1.
- Produces: `CreateTaskModal` sin guard `canCreate`; checkbox editable post-create.

- [ ] **Step 1: Helper API**

En `src/services/api.ts`:

```ts
export function toggleTaskShareLinkApi(taskId: string, enabled: boolean) {
  return request<{ shareLinkUrl: string | null }>(
    `/tasks/${taskId}/share-link`,
    { method: 'POST', body: JSON.stringify({ enabled }) },
  );
}
```

- [ ] **Step 2: Quitar guard `canCreate`**

En `CreateTaskModal.tsx`, eliminar:

```ts
const hasValidRecipient = useMemo(...);
const canCreate = shareEnabled || hasValidRecipient;
```

Y en el botón "Crear tarea":

```tsx
disabled={saving || taskCreated || !title.trim()}
```

(Solo pide título; sin `canCreate`.)

- [ ] **Step 3: Handler para toggle checkbox post-create**

```ts
const [linkBusy, setLinkBusy] = useState(false);

const handleToggleShareLink = async (nextEnabled: boolean) => {
  if (!createdTaskId) {
    // Pre-create: solo update local del shareEnabled state.
    setShareEnabled(nextEnabled);
    return;
  }
  if (!nextEnabled && shareLinkUrl) {
    // Confirm inline antes de destildar (link viejo dejará de funcionar).
    if (!window.confirm('El enlace actual dejará de funcionar. ¿Continuar?')) {
      return;
    }
  }
  setLinkBusy(true);
  const res = await toggleTaskShareLinkApi(createdTaskId, nextEnabled);
  setLinkBusy(false);
  if (res.error || !res.data) {
    setError(res.error ?? 'No se pudo actualizar el enlace');
    return;
  }
  setShareEnabled(nextEnabled);
  setShareLinkUrl(res.data.shareLinkUrl);
};
```

Reemplazar el `onChange={(e) => setShareEnabled(e.target.checked)}` del checkbox (busca en el archivo) por `onChange={(e) => handleToggleShareLink(e.target.checked)}`.

El checkbox debe estar `disabled={linkBusy}` (no `disabled={!taskCreated}`).

- [ ] **Step 4: Actualizar la prop `disabled` que pasa a `StepsTab`**

Verificar el uso actual del prop `disabled` en `<StepsTab disabled={...} />`. El comportamiento previo era: `disabled={!taskCreated}` (destinatarios locked hasta crear). Debe seguir igual para destinatarios. Pero el checkbox de "generar link" ya NO respeta ese disabled — ver Task 2 (StepsTab prop share-checkbox aparte).

Actually re-verificando `StepsTab.tsx` — el checkbox share vive DENTRO de `StepsTab`. Necesita props extra:
- `disabled: boolean` (para destinatarios)
- `linkCheckboxDisabled: boolean` (solo para el checkbox del link, controlado por `linkBusy`)

O más simple: mover el handler completo del checkbox afuera y pasar `shareEnabled + onChange` como props explícitas. Ver si vale la pena.

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/components/home/CreateTaskModal.tsx src/components/home/taskBuilder/StepsTab.tsx
git commit -m "feat(tasks): CreateTaskModal permite crear sin link + checkbox editable post-create"
```

---

### Task 6: Frontend — extraer `SubmissionsListView` desde `RecordsTable.tsx`

**Files:**
- Create: `src/components/reports/SubmissionsListView.tsx`
- Modify: `src/components/reports/RecordsTable.tsx` (usar el extraído)

**Interfaces:**
- Consumes: `RecordRowDto[]` (del api).
- Produces: componente `SubmissionsListView` que renderiza la tabla + Ver PDF + mobile cards + paginación.

- [ ] **Step 1: Identificar el bloque a extraer**

Leer `RecordsTable.tsx` desde el bloque `data.length === 0 ? ... : ...` (línea ~144) hasta el fin del componente. Ese bloque (con paginación) es lo que se extrae.

- [ ] **Step 2: Crear `SubmissionsListView.tsx`**

```tsx
import { useMemo } from 'react';
import type { RecordRowDto } from '../../services/api';
import { usePdfPreview } from '../../hooks/usePdfPreview';
import PdfPreviewModal from './PdfPreviewModal';
import Icon from '../common/Icon';

type Props = {
  data: RecordRowDto[];
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
};

export default function SubmissionsListView({
  data,
  total,
  page,
  pageCount,
  onPageChange,
  emptyMessage = 'No hay registros en el rango seleccionado.',
}: Props) {
  const preview = usePdfPreview();

  // Copiar lógica: openId, handleRowClick, summaryCols, tabla desktop, cards mobile,
  // paginación, PdfPreviewModal.
  // ...
}
```

Migrar el JSX del bloque completo desde RecordsTable (tabla desktop, cards mobile, paginación, modal PDF).

- [ ] **Step 3: Refactor `RecordsTable.tsx` para usar el extraído**

Reemplazar el bloque grande por:

```tsx
<SubmissionsListView
  data={data}
  total={total}
  page={page}
  pageCount={pageCount}
  onPageChange={setPage}
/>
```

Y mantener el resto de RecordsTable (filtros, header, bulk-pdf button).

- [ ] **Step 4: Verificar TypeScript + build visual**

```bash
npx tsc --noEmit -p tsconfig.json
```

Test visual: recarga la vista Registros y PDFs — debe verse idéntica.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/SubmissionsListView.tsx src/components/reports/RecordsTable.tsx
git commit -m "refactor(reports): extraer SubmissionsListView desde RecordsTable"
```

---

### Task 7: Frontend — nuevo `TasksReportPanel.tsx` con detalle inline

**Files:**
- Modify: `src/services/api.ts` (helpers para los endpoints del Task 2 y 3)
- Create: `src/components/reports/TasksReportPanel.tsx`

**Interfaces:**
- Consumes: `GET /forms/:formId/tasks`, `GET /tasks/:id/detail`, `POST /tasks/:id/steps/:stepIndex/resend`, `POST /tasks/:id/bulk-pdf`, `POST /tasks/:id/share-link`.
- Produces: componente listo para usar en `ReportsPage.tsx` (Task 8).

- [ ] **Step 1: Helpers API**

En `src/services/api.ts`:

```ts
export type TaskSummaryDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  totalRecipients: number;
  completedCount: number;
  pendingCount: number;
  hasShareLink: boolean;
};

export type TaskRecipientDto = {
  stepIndex: number;
  email: string;
  name: string;
  status: 'in_progress' | 'pending' | 'completed';
  submittedAt: string | null;
  canResend: boolean;
  lastResendAt: string | null;
};

export type TaskDetailDto = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string;
  shareLinkUrl: string | null;
  recipients: TaskRecipientDto[];
  submissions: RecordRowDto[];   // reusa el existente
};

export function getFormTasksApi(formId: string) {
  return request<TaskSummaryDto[]>(`/tasks/by-form/${formId}`);   // o /forms/:formId/tasks
}

export function getTaskDetailApi(taskId: string) {
  return request<TaskDetailDto>(`/tasks/${taskId}/detail`);
}

export function resendTaskStepApi(taskId: string, stepIndex: number) {
  return request<{ ok: true; sentAt: string }>(
    `/tasks/${taskId}/steps/${stepIndex}/resend`,
    { method: 'POST', body: '{}' },
  );
}

export function requestTaskBulkPdfApi(taskId: string) {
  return request<{ ok: true; message: string }>(
    `/tasks/${taskId}/bulk-pdf`,
    { method: 'POST', body: '{}' },
  );
}
```

- [ ] **Step 2: Componente `TasksReportPanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  getFormTasksApi,
  getTaskDetailApi,
  resendTaskStepApi,
  requestTaskBulkPdfApi,
  toggleTaskShareLinkApi,
  type TaskSummaryDto,
  type TaskDetailDto,
} from '../../services/api';
import SubmissionsListView from './SubmissionsListView';
import Icon from '../common/Icon';

type Props = {
  formId: string;
  formName: string;
};

export default function TasksReportPanel({ formId, formName }: Props) {
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resendBusy, setResendBusy] = useState<number | null>(null);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Load tasks list
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getFormTasksApi(formId);
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? 'No se pudieron cargar las tareas');
        return;
      }
      setTasks(res.data);
    };
    if (formId) load();
  }, [formId]);

  // Load detail on expand
  const handleExpand = async (taskId: string) => {
    if (expandedId === taskId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(taskId);
    setDetail(null);
    setDetailLoading(true);
    const res = await getTaskDetailApi(taskId);
    setDetailLoading(false);
    if (res.data) setDetail(res.data);
  };

  const handleCopyLink = async () => {
    if (!detail?.shareLinkUrl) return;
    await navigator.clipboard.writeText(detail.shareLinkUrl);
  };

  const handleToggleShareLink = async (nextEnabled: boolean) => {
    if (!detail) return;
    if (!nextEnabled && detail.shareLinkUrl) {
      if (!window.confirm('El enlace actual dejará de funcionar. ¿Continuar?')) return;
    }
    const res = await toggleTaskShareLinkApi(detail.id, nextEnabled);
    if (res.data) {
      setDetail({ ...detail, shareLinkUrl: res.data.shareLinkUrl });
    }
  };

  const handleResend = async (stepIndex: number) => {
    if (!detail) return;
    setResendBusy(stepIndex);
    setResendFeedback(null);
    const res = await resendTaskStepApi(detail.id, stepIndex);
    setResendBusy(null);
    if (res.error) {
      setResendFeedback(res.error);
      return;
    }
    setResendFeedback(`Correo reenviado a ${detail.recipients[stepIndex].email}`);
    // Refetch detail para actualizar lastResendAt/canResend.
    const fresh = await getTaskDetailApi(detail.id);
    if (fresh.data) setDetail(fresh.data);
  };

  const handleBulkPdf = async () => {
    if (!detail) return;
    setBulkFeedback(null);
    const res = await requestTaskBulkPdfApi(detail.id);
    if (res.error) {
      setBulkFeedback(res.error);
      return;
    }
    setBulkFeedback(res.data?.message ?? 'PDFs en camino por correo.');
  };

  // Render: lista de tareas + detalle expandido
  // ... (usar SubmissionsListView para el bloque de submissions)
}
```

**Estructura JSX** (esqueleto — completar el implementer con el layout del spec):

```tsx
<div className="animate-fade-up">
  {loading && <div>Cargando tareas…</div>}
  {error && <div className="text-red-600">{error}</div>}
  {!loading && !error && tasks.length === 0 && (
    <div>No hay tareas creadas para este formulario.</div>
  )}
  {!loading && !error && tasks.map((t) => (
    <div key={t.id}>
      <div onClick={() => handleExpand(t.id)}>
        {/* Fila: título, fecha, badges */}
      </div>
      {expandedId === t.id && (
        <div>
          {detailLoading && <div>Cargando detalle…</div>}
          {detail && (
            <>
              {/* Stats */}
              <div>
                <span>{detail.recipients.length} destinatarios</span>
                <span>{detail.recipients.filter(r => r.status === 'completed').length} completados</span>
                <span>{detail.recipients.filter(r => r.status !== 'completed').length} pendientes</span>
              </div>

              {/* Bloque link */}
              <div>
                <label>
                  <input type="checkbox" checked={!!detail.shareLinkUrl} onChange={e => handleToggleShareLink(e.target.checked)} />
                  Generar enlace compartible
                </label>
                {detail.shareLinkUrl && (
                  <div>
                    <input readOnly value={detail.shareLinkUrl} />
                    <button onClick={handleCopyLink}>Copiar</button>
                  </div>
                )}
              </div>

              {/* Tabla destinatarios */}
              <table>
                {detail.recipients.map(r => (
                  <tr key={r.stepIndex}>
                    <td>{r.email}</td><td>{r.name}</td>
                    <td>{r.status === 'completed' ? '✓' : '⏳'}</td>
                    <td>
                      {r.status !== 'completed' && (
                        <button
                          disabled={!r.canResend || resendBusy === r.stepIndex}
                          onClick={() => handleResend(r.stepIndex)}
                        >
                          {resendBusy === r.stepIndex ? 'Enviando…' : 'Reenviar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </table>

              {/* Submissions */}
              <SubmissionsListView
                data={detail.submissions}
                total={detail.submissions.length}
                page={1}
                pageCount={1}
                onPageChange={() => {}}
                emptyMessage="Aún no hay registros completados."
              />
              <button onClick={handleBulkPdf}>Descargar todos los PDF</button>
              {bulkFeedback && <div>{bulkFeedback}</div>}
            </>
          )}
        </div>
      )}
    </div>
  ))}
</div>
```

**Estilos Tailwind**: usar el mismo lenguaje visual que `RecordsTable.tsx` (glassy cards, gradient buttons, badges consistentes). El implementer copia los patrones tal como en el resto de `/reports`.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts src/components/reports/TasksReportPanel.tsx
git commit -m "feat(reports): TasksReportPanel con detalle inline + reenvio + link + bulk-pdf"
```

---

### Task 8: Frontend — agregar 3ra pestaña "Tareas" en `ReportsPage.tsx`

**Files:**
- Modify: `src/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `TasksReportPanel` del Task 7.

- [ ] **Step 1: Extender el union type y el array TABS**

```ts
type Tab = 'excel' | 'records' | 'tasks';

const TABS = [
  { id: 'excel' as Tab, icon: 'table', label: 'Excel por correo' },
  { id: 'records' as Tab, icon: 'fileText', label: 'Registros y PDFs' },
  { id: 'tasks' as Tab, icon: 'inbox', label: 'Tareas' },
];
```

- [ ] **Step 2: Renderizar el panel**

Después del bloque `{tab === 'records' && ...}`:

```tsx
{tab === 'tasks' && selectedForm && (
  <TasksReportPanel formId={selectedForm.id} formName={selectedForm.name} />
)}
{tab === 'tasks' && !selectedForm && <SelectPrompt />}
```

Importar `TasksReportPanel` arriba.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ReportsPage.tsx
git commit -m "feat(reports): 3ra pestana Tareas en ReportsPage"
```

---

## Notas para el ejecutor SDD

- **Task order**: backend primero (1→2→3→4), luego frontend (5→6→7→8). Task 5 puede empezar en paralelo con Task 6 si el implementer quiere (independientes).
- **Tests requeridos**: Tasks 1, 2, 3, 4 (backend). Frontend valida por TypeScript + E2E manual.
- **Model selection**:
  - Task 1: sonnet (endpoint + tests)
  - Task 2: sonnet (2 GETs + agregación stats)
  - Task 3: sonnet (throttle + wireup con BulkPdfService)
  - Task 4: sonnet (cron nuevo)
  - Task 5: haiku (refactor mecánico)
  - Task 6: haiku (refactor extract)
  - Task 7: sonnet (componente grande con múltiples interacciones)
  - Task 8: haiku (wireup)
- **Whole-branch final review** al terminar: opus.
- **E2E manual** al final:
  - Item 1: crear tarea sin nada → botones habilitados. Tildar link → aparece. Destildar con confirm → desaparece.
  - Item 2: elegir form con tareas, ver lista, expandir, ver stats, reenviar → mensaje. Copiar link. Toggle link. Ver PDF. Descargar todos.
  - Cron: no probable en E2E; validar con log "Cron recordatorios de tareas — inicio" a las 9 AM o 3 PM.
