# Eliminar tarea + link de un solo llenado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Agregar (1) botón "Eliminar tarea" en Reportes > Tareas que soft-deleta la tarea (status=cancelled), detiene correos automáticos y bloquea el share link. (2) Toggle "Solo un llenado" por-tarea que invalida el share link tras el primer submit.

**Architecture:** Backend reusa `PATCH /tasks/:id/cancel` (con ownership check nuevo) y extiende `Task.shareLink` con `oneShot: boolean`. Frontend agrega botón + modal en `TasksReportPanel` y checkbox en `CreateTaskModal` + detalle expandido.

**Tech Stack:** NestJS 11 + Mongoose 9 + React 19 + TypeScript estricto + Tailwind. Sin nuevas deps.

## Global Constraints

- **Backward compat DB**: `oneShot` es opcional (default false via `?.oneShot` en el código). Sin migración.
- **Ownership**: `cancel` requiere `task.createdById === userId` O rol ADMIN (verificar patrón del proyecto — grep `UserRole.ADMIN` en tasks.controller.ts).
- **Idempotencia cancel**: cancelar una tarea ya cancelled retorna task sin cambio.
- **NO `git add -A`** — commit explícito por archivo.
- **NO commits con emojis** salvo los ya usados en el codebase.
- **Copy español** consistente.
- **Reusos**: `ConfirmModal` de `RecordsTable.tsx`, `toggleTaskShareLinkApi` de `services/api.ts` (extender con `oneShot` opcional).

---

### Task 1: Backend — ownership en cancel + bloqueo share tras cancel

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts` (cancel + findByShareToken + submitFromShare)
- Modify: `backend/src/tasks/tasks.controller.ts` (endpoint cancel pasa userId)
- Create: `backend/src/tasks/tasks-cancel.service.spec.ts` (4 tests)

**Interfaces:**
- Consumes: `Task` schema (sin cambios en este task).
- Produces: `cancel(id, userId)` con ownership. `findByShareToken` y `submitFromShare` bloquean `status:'cancelled'`.

- [ ] **Step 1: Refactor `cancel` en tasks.service.ts**

Ubicar la función `async cancel(id: string): Promise<Task>` (~línea 591). Reemplazar por:

```ts
async cancel(id: string, userId: number): Promise<Task> {
  const task = await this.taskModel.findById(id);
  if (!task) throw new NotFoundException('Tarea no encontrada');
  if (task.createdById !== userId) {
    throw new ForbiddenException('No autorizado');
  }
  if (task.status === 'cancelled') {
    return task;   // idempotente
  }
  task.status = 'cancelled';
  await task.save();
  return task;
}
```

- [ ] **Step 2: Bloquear share link en tareas canceladas**

En `findByShareToken(token)` (~línea 604), después del `if (!task) throw ...`, agregar:

```ts
if (task.status === 'cancelled') {
  throw new NotFoundException('Enlace no válido o desactivado');
}
```

En `submitFromShare(token, data)` (~línea 679), después del find inicial del task, agregar el mismo chequeo. **Importante**: mensaje idéntico al de findByShareToken para no revelar la existencia de la tarea.

- [ ] **Step 3: Endpoint cancel pasa userId**

En `tasks.controller.ts` (~línea 186):

```ts
@UseGuards(JwtAuthGuard)
@Patch(':id/cancel')
async cancel(@Param('id') id: string, @Req() req: AuthedRequest) {
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuario no autenticado');
  return this.tasksService.cancel(id, Number(user.id));
}
```

Verificar imports (`Req`, `UnauthorizedException`, `AuthedRequest` — ya usados en otros endpoints del mismo archivo).

- [ ] **Step 4: Tests jest**

Crear `backend/src/tasks/tasks-cancel.service.spec.ts` con 4 tests:

```ts
describe('TasksService.cancel', () => {
  it('cambia status a cancelled y persiste', async () => {...});
  it('idempotente: llamar 2× no cambia nada', async () => {...});
  it('rechaza 403 si createdById !== userId', async () => {...});
  it('rechaza 404 si task no existe', async () => {...});
});
```

Usar `getModelToken(Task.name)` mock. Patrón como `tasks-share-link.service.spec.ts`.

- [ ] **Step 5: Build + tests**

```bash
cd backend
npx jest src/tasks/tasks-cancel.service.spec.ts
npm run build
```

Verificar además que tests existentes siguen pasando (no debe romper).

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks-cancel.service.spec.ts
git commit -m "feat(tasks): cancel con ownership check + bloquea share link tras cancel"
```

---

### Task 2: Backend — Task.shareLink.oneShot + submitFromShare invalida link

**Files:**
- Modify: `backend/src/tasks/task.schema.ts` (agregar `oneShot` al TaskShareLink)
- Modify: `backend/src/tasks/tasks.service.ts` (create acepta oneShotLink; toggleShareLink acepta oneShot; submitFromShare desactiva enabled si oneShot)
- Modify: `backend/src/tasks/tasks.controller.ts` (endpoints `POST /tasks` y `POST /tasks/:id/share-link` aceptan oneShot en body)
- Create: `backend/src/tasks/tasks-oneshot.service.spec.ts` (3 tests)

**Interfaces:**
- Consumes: `Task` schema del Task 1 (sin cambios).
- Produces: `shareLink.oneShot: boolean` (default false). Endpoints aceptan `oneShot`/`oneShotLink` en body. Submit invalida link si oneShot.

- [ ] **Step 1: Agregar `oneShot` al schema TaskShareLink**

En `backend/src/tasks/task.schema.ts`, ubicar la clase `TaskShareLink` (o el `@Schema`/`@Prop` embedded):

```ts
@Prop({ type: Boolean, required: true, default: false })
oneShot: boolean;
```

Verificar que el schema del subdocumento se exporte con el nuevo campo.

- [ ] **Step 2: `create` acepta `oneShotLink` en el DTO**

En `backend/src/tasks/tasks.dto.ts`, agregar a `CreateTaskDto`:

```ts
oneShotLink?: boolean;
```

En `tasks.service.ts` `create()` (~línea 96), donde arma `shareLink: dto.generateShareLink ? {...} : null`, extender:

```ts
shareLink: dto.generateShareLink
  ? {
      token: randomBytes(8).toString('base64url'),
      enabled: true,
      oneShot: dto.oneShotLink === true,
    }
  : null,
```

En `tasks.controller.ts` `POST /tasks` (~línea 47), agregar al dto:

```ts
generateShareLink: body.generateShareLink === true,
oneShotLink: body.oneShotLink === true,
```

- [ ] **Step 3: `toggleShareLink` acepta `oneShot` opcional**

En `tasks.service.ts` `toggleShareLink(taskId, enabled, userId)`, extender la firma:

```ts
async toggleShareLink(
  taskId: string,
  enabled: boolean,
  userId: number,
  oneShot?: boolean,   // NUEVO opcional
): Promise<{ shareLinkUrl: string | null }> {
  // ... existing task find + ownership check
  if (enabled) {
    if (task.shareLink?.enabled) {
      // idempotente: si el body trae oneShot explícito, aplica; sino no-op
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
    task.shareLink = null;
    await task.save();
  }
  // ... existing return con shareLinkUrl
}
```

En `tasks.controller.ts` `POST /:id/share-link`:

```ts
async toggleShareLink(
  @Param('id') id: string,
  @Body() body: { enabled: boolean; oneShot?: boolean },
  @Req() req: AuthedRequest,
) {
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuario no autenticado');
  return this.tasksService.toggleShareLink(
    id,
    body.enabled === true,
    Number(user.id),
    body.oneShot,
  );
}
```

- [ ] **Step 4: `submitFromShare` invalida link si oneShot**

En `tasks.service.ts` `submitFromShare(token, data)`, después de que el submission se persistió exitosamente (return del `submissionsService.submit(...)` con el submissionId), agregar ANTES del return:

```ts
if (task.shareLink?.oneShot) {
  task.shareLink.enabled = false;
  await task.save();
}
```

**Importante**: `task` es el `.lean()` del find inicial, así que `task.save()` no funciona en el lean doc. Necesitas re-fetch como documento Mongoose:

```ts
if (task.shareLink?.oneShot) {
  await this.taskModel.updateOne(
    { _id: task._id },
    { $set: { 'shareLink.enabled': false } },
  );
}
```

Esta es la forma correcta (evita el problema del lean doc).

- [ ] **Step 5: Tests jest**

Crear `backend/src/tasks/tasks-oneshot.service.spec.ts` con 3 tests:

```ts
describe('OneShot share link', () => {
  it('submitFromShare invalida enabled=false si oneShot=true', async () => {...});
  it('submitFromShare NO invalida si oneShot=false o undefined', async () => {...});
  it('toggleShareLink con oneShot=true crea link con oneShot en shareLink', async () => {...});
});
```

Mock del `taskModel` para verificar `updateOne` con el filtro correcto.

- [ ] **Step 6: Build + tests**

```bash
cd backend
npx jest src/tasks
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/task.schema.ts backend/src/tasks/tasks.dto.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks-oneshot.service.spec.ts
git commit -m "feat(tasks): shareLink.oneShot invalida el link tras el primer submit"
```

---

### Task 3: Frontend — botón "Eliminar" + badges en TasksReportPanel + checkbox oneShot en detalle

**Files:**
- Modify: `src/services/api.ts` (helper `cancelTaskApi`; extender `toggleTaskShareLinkApi` con oneShot)
- Modify: `src/components/reports/TasksReportPanel.tsx` (botón Eliminar + modal + badges + checkbox oneShot en detalle)

**Interfaces:**
- Consumes: `PATCH /tasks/:id/cancel` (Task 1) + `POST /tasks/:id/share-link` extendido (Task 2).
- Produces: UI completa para eliminar y para toggle oneShot desde Reportes.

- [ ] **Step 1: Helpers API**

En `src/services/api.ts`:

```ts
export function cancelTaskApi(taskId: string) {
  return request<{ status: string }>(`/tasks/${taskId}/cancel`, { method: 'PATCH' });
}
```

Y **extender** el existente `toggleTaskShareLinkApi` para aceptar `oneShot?: boolean`:

```ts
export function toggleTaskShareLinkApi(
  taskId: string,
  enabled: boolean,
  oneShot?: boolean,
) {
  const body: { enabled: boolean; oneShot?: boolean } = { enabled };
  if (oneShot !== undefined) body.oneShot = oneShot;
  return request<{ shareLinkUrl: string | null }>(
    `/tasks/${taskId}/share-link`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
```

- [ ] **Step 2: Extender `TaskSummaryDto` y `TaskDetailDto`**

En `src/services/api.ts`, agregar campo `status` a `TaskSummaryDto` si no está, y `shareLinkOneShot: boolean` (o similar) a ambos DTOs para que el frontend sepa el estado actual del oneShot. Verificar la respuesta del backend en Task 2 — necesitará devolver también `shareLink.oneShot` en el detail.

**Backend hint**: en Task 2, asegurar que `getDetail` incluye `shareLinkOneShot: task.shareLink?.oneShot === true` en el DTO. Si Task 2 no lo agregó explícitamente, agregarlo aquí (grep `getDetail` en `tasks.service.ts`).

- [ ] **Step 3: Badges de status en la lista de tareas**

En `TasksReportPanel.tsx`, en la fila de cada tarea (grep el mapping), agregar helper:

```ts
function statusBadge(status: string) {
  if (status === 'in_progress') return { label: 'Activa', className: 'bg-emerald-100 text-emerald-900' };
  if (status === 'completed') return { label: 'Completada', className: 'bg-cyan-100 text-cyan-900' };
  if (status === 'cancelled') return { label: 'Nula', className: 'bg-slate-200 text-slate-600 line-through' };
  return { label: status, className: 'bg-slate-100 text-slate-700' };
}
```

Y en la fila:

```tsx
<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
  {badge.label}
</span>
```

- [ ] **Step 4: Botón "Eliminar" en la fila**

Solo visible si `task.status === 'in_progress'`:

```tsx
{task.status === 'in_progress' && (
  <button
    onClick={(e) => { e.stopPropagation(); setDeleteTargetId(task.id); }}
    className="ml-2 rounded-lg border-[1.5px] border-red-200 bg-red-50 px-2.5 py-1 text-[11.5px] font-semibold text-red-700 transition hover:bg-red-100"
    title="Eliminar tarea"
  >
    <Icon name="trash" size={13} /> Eliminar
  </button>
)}
```

Verificar que `Icon` tiene el ícono `trash` — si no, usar `x` o agregar en `Icon.tsx`.

- [ ] **Step 5: Modal de confirmación**

Reusar `ConfirmModal` (grep en `RecordsTable.tsx` para verificar API). Estado nuevo:

```ts
const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
const [deleteBusy, setDeleteBusy] = useState(false);

const handleDelete = async () => {
  if (!deleteTargetId) return;
  setDeleteBusy(true);
  const res = await cancelTaskApi(deleteTargetId);
  setDeleteBusy(false);
  setDeleteTargetId(null);
  if (res.error) {
    setError(res.error);
    return;
  }
  if (expandedId === deleteTargetId) setExpandedId(null);
  // Refetch tasks list
  const list = await getFormTasksApi(formId);
  if (list.data) setTasks(list.data);
};
```

JSX:

```tsx
{deleteTargetId && (
  <ConfirmModal
    title="Eliminar tarea"
    message={`¿Eliminar esta tarea? Los destinatarios que no la completaron ya no recibirán recordatorios y el enlace compartible dejará de funcionar. Esta acción no se puede deshacer.`}
    confirmLabel={deleteBusy ? 'Eliminando…' : 'Eliminar'}
    cancelLabel="Cancelar"
    variant="danger"
    onConfirm={handleDelete}
    onCancel={() => setDeleteTargetId(null)}
  />
)}
```

Verificar la API real de `ConfirmModal` en `src/components/common/ConfirmModal.tsx`.

- [ ] **Step 6: Checkbox "Solo un llenado" en el detalle expandido**

En el bloque "Enlace compartible" del detalle, después del checkbox "Generar enlace":

```tsx
{detail.shareLinkUrl && (
  <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
    <input
      type="checkbox"
      checked={detail.shareLinkOneShot ?? false}
      disabled={oneShotBusy}
      onChange={(e) => handleToggleOneShot(e.target.checked)}
    />
    Solo permitir un llenado por link
  </label>
)}
```

Handler:

```ts
const [oneShotBusy, setOneShotBusy] = useState(false);

const handleToggleOneShot = async (nextValue: boolean) => {
  if (!detail) return;
  setOneShotBusy(true);
  const res = await toggleTaskShareLinkApi(detail.id, true, nextValue);
  setOneShotBusy(false);
  if (res.error) {
    setError(res.error);
    return;
  }
  setDetail({ ...detail, shareLinkOneShot: nextValue });
};
```

- [ ] **Step 7: Hint "enlace utilizado" si shareLinkUrl null y oneShot true**

Si el detail tiene `shareLinkOneShot` y `shareLinkUrl === null` (porque el submit lo desactivó), mostrar hint gris:

```tsx
{detail.shareLinkOneShot && !detail.shareLinkUrl && (
  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
    Este enlace ya fue utilizado y no acepta nuevas respuestas. Toca "Generar enlace" para crear uno nuevo.
  </div>
)}
```

Requiere que el backend devuelva `shareLinkOneShot` incluso cuando `shareLinkUrl` es null (porque `shareLink.oneShot` en DB persiste aunque `enabled` sea false).

**Backend adicional en Task 2 Step 4**: `getDetail` debe leer `task.shareLink?.oneShot === true` sin importar `enabled`. Ver que el service haga:

```ts
shareLinkUrl: task.shareLink?.enabled && task.shareLink.token
  ? `${baseUrl}/t/${task.shareLink.token}`
  : null,
shareLinkOneShot: task.shareLink?.oneShot === true,
```

- [ ] **Step 8: TypeScript + commit**

```bash
npx tsc --noEmit -p tsconfig.json
```

```bash
git add src/services/api.ts src/components/reports/TasksReportPanel.tsx
git commit -m "feat(reports): boton Eliminar tarea + badges de status + toggle oneShot en detalle"
```

---

### Task 4: Frontend — checkbox "Solo un llenado" en CreateTaskModal

**Files:**
- Modify: `src/components/home/CreateTaskModal.tsx` (estado + handler + envío en POST /tasks)
- Modify: `src/components/home/taskBuilder/StepsTab.tsx` (checkbox condicional)

**Interfaces:**
- Consumes: `POST /tasks` extendido con `oneShotLink` (Task 2).
- Produces: checkbox condicional en el modal para tildar oneShot en tareas nuevas.

- [ ] **Step 1: Nuevo estado + envío en `CreateTaskModal.tsx`**

Agregar state:

```ts
const [oneShotLink, setOneShotLink] = useState(false);
```

En `handleCreate`, añadir al body del POST:

```ts
body: JSON.stringify({
  // ... existing fields
  generateShareLink: shareEnabled,
  oneShotLink: shareEnabled ? oneShotLink : false,
}),
```

Pasar como props al `StepsTab`:

```tsx
<StepsTab
  // ... existing props
  oneShotLink={oneShotLink}
  onOneShotLinkChange={setOneShotLink}
/>
```

- [ ] **Step 2: Checkbox en `StepsTab.tsx`**

En el tipo de props, agregar:

```ts
oneShotLink?: boolean;
onOneShotLinkChange?: (v: boolean) => void;
```

Y en el JSX, después del checkbox "Generar enlace compartible", agregar (solo visible si `shareEnabled=true`):

```tsx
{shareEnabled && (
  <label
    className={`ml-6 mt-2 flex items-center gap-2 text-[12px] ${
      shareCheckboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
    }`}
  >
    <input
      type="checkbox"
      checked={oneShotLink ?? false}
      disabled={shareCheckboxDisabled}
      onChange={(e) => onOneShotLinkChange?.(e.target.checked)}
    />
    <span>
      Solo permitir un llenado por link
      <span className="ml-1 text-[10.5px] text-slate-500">
        (Tras el primer submit el enlace deja de funcionar.)
      </span>
    </span>
  </label>
)}
```

- [ ] **Step 3: TypeScript + commit**

```bash
npx tsc --noEmit -p tsconfig.json
```

```bash
git add src/components/home/CreateTaskModal.tsx src/components/home/taskBuilder/StepsTab.tsx
git commit -m "feat(tasks): checkbox oneShot en CreateTaskModal"
```

---

## Notas para el ejecutor SDD

- **Orden estricto**: Tasks 1 y 2 son backend (Task 1 → Task 2, secuencial porque Task 2 depende de shareLink shape del Task 1). Luego Tasks 3 y 4 son frontend (pueden ir en paralelo pero por simplicidad hacer 3 → 4).
- **Tests requeridos**: Tasks 1 y 2 (backend). Frontend valida por TypeScript + E2E manual.
- **Model selection**:
  - Task 1: sonnet (ownership + integration)
  - Task 2: sonnet (schema + endpoint refactor)
  - Task 3: sonnet (UI mediana con modal + checkbox)
  - Task 4: haiku (checkbox mecánico)
- **Whole-branch final review** al terminar: opus.
- **E2E manual** al final:
  - Item 1: eliminar tarea → badge "Nula" → intentar abrir link → 404 → intentar submit → 404.
  - Item 2: crear tarea con oneShot ON → llenar en pestaña A → intentar llenar en pestaña B → 404.
  - Toggle oneShot desde Reportes en tarea existente → aplica en siguientes submits.
