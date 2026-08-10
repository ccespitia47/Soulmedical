# Task Modal Two-Step Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el flujo del modal de crear tarea a 2 pasos: primero `Crear tarea` (persiste + genera link, sin correos), después `Enviar tarea` (agrega destinatarios y dispara correos).

**Architecture:** Backend agrega endpoint `POST /api/tasks/:id/send` que recibe steps y dispara correos (rechaza si el task ya tiene steps para evitar doble envío); `POST /api/tasks` relaja la validación de `steps` obligatorios. Frontend refactoriza `CreateTaskModal` con estado `taskCreated` que gobierna la botonera del footer y el estado disabled/enabled de los inputs de destinatarios; el link compartible pasa de modal-secundario a bloque inline dentro del tab Destinatarios.

**Tech Stack:** NestJS 11 + Mongoose 9 (backend), React 19 + TypeScript + Vite (frontend). Sin dependencias nuevas.

## Global Constraints

- `POST /api/tasks/:id/send` es idempotente: si `task.steps.length > 0` ya, devuelve 409 Conflict — previene doble envío.
- `POST /api/tasks/:id/send` requiere JWT + ownership (`task.createdById === req.user.id`); devuelve 403 si no.
- `POST /api/tasks` acepta `steps: []` sin lanzar error de "agrega al menos un destinatario" (esa validación se movió al `/send`).
- Cerrar el modal sin dar `Enviar tarea` deja la tarea creada + link funcional; NO se guardan destinatarios ingresados en el input (se descartan porque nunca dispararon correo).
- El link inline reemplaza al modal secundario del commit `9ae457d` — el bloque JSX debe eliminarse en el mismo cambio.
- Info y Prediligenciar quedan en `<fieldset disabled>` después de `taskCreated=true` (la tarea ya está persistida, no se re-edita).

---

## Estructura de archivos

**Modificados backend:**
- `backend/src/tasks/tasks.service.ts` (nuevo método `sendTask`; relajar check en `create`)
- `backend/src/tasks/tasks.controller.ts` (nuevo endpoint `POST :id/send`)

**Modificados frontend:**
- `src/components/home/CreateTaskModal.tsx` (estado `taskCreated`+`createdTaskId`, `handleCreate`/`handleSend` separados, refactor botonera footer, fieldset disabled en tabs Info/Prefill, eliminar modal secundario del link)
- `src/components/home/taskBuilder/StepsTab.tsx` (prop `disabled`, bloque link inline con URL + Copiar)

**Sin cambios:**
- `backend/src/tasks/task.schema.ts` (ya tiene `shareLink` de la sesión anterior)
- `backend/src/tasks/tasks.dto.ts` (ya tiene `generateShareLink`)
- `src/components/home/taskBuilder/useTaskSteps.ts` (mismo controller de steps)
- `src/services/api.ts` (el POST /tasks/:id/send se puede llamar con `fetch` inline como el resto del modal)

---

## FASE 1 · Backend

### Task 1: Endpoint `POST /api/tasks/:id/send` + relajar validación de create

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.controller.ts`

**Interfaces:**
- Consumes: `TasksService.create()` (relajar), `sendStepEmail(task, index)` privado (existente), schema `TaskStep`
- Produces:
  - `TasksService.sendTask(taskId: string, steps: Array<{recipientEmail: string; recipientName?: string}>, userId: number): Promise<{ok: true; sentCount: number}>`
  - `POST /api/tasks/:id/send` — JWT + body `{steps}` → `{ok, sentCount}`

- [ ] **Step 1: Relajar el check de steps obligatorios en `create()`**

En `backend/src/tasks/tasks.service.ts`, buscar el método `create()`. Localizar (aproximadamente al inicio del método) el bloque que valida que haya al menos un step, algo como:

```ts
if (!dto.steps || dto.steps.length === 0) {
  throw new BadRequestException('Agrega al menos un destinatario');
}
```

**Reemplazar** por lógica que acepta `steps: []`:

```ts
const steps = (dto.steps ?? []).filter(
  (s) => s.recipientEmail?.trim() && s.recipientEmail.includes('@'),
);
// NO throw si steps está vacío — el flujo nuevo permite crear la tarea
// primero (solo con shareLink) y agregar destinatarios después via
// POST /api/tasks/:id/send.
```

Continuar el resto de `create()` sin cambios (los steps vacíos se persisten como array vacío). Después de crear la task, si `steps.length > 0`, se sigue disparando `sendStepEmail(task, 0)` como hoy. Si `steps.length === 0`, se salta el envío inicial de correo:

Buscar la línea `await this.sendStepEmail(task, 0);` en `create()` y envolverla:

```ts
if (task.steps.length > 0) {
  await this.sendStepEmail(task, 0);
}
```

- [ ] **Step 2: Agregar método `sendTask` en `TasksService`**

Después del método `create()` (o donde encajen lógicamente los métodos públicos), agregar:

```ts
async sendTask(
  taskId: string,
  steps: Array<{ recipientEmail: string; recipientName?: string }>,
  userId: number,
): Promise<{ ok: true; sentCount: number }> {
  const task = await this.taskModel.findById(taskId);
  if (!task) throw new NotFoundException('Tarea no encontrada');

  // Ownership: solo el creador puede enviarla.
  if (task.createdById !== userId) {
    throw new ForbiddenException('No autorizado');
  }

  // Idempotencia: si ya tiene steps, la tarea ya fue enviada.
  if (task.steps.length > 0) {
    throw new ConflictException('La tarea ya fue enviada');
  }

  const validSteps = steps.filter(
    (s) => s.recipientEmail?.trim() && s.recipientEmail.includes('@'),
  );
  if (validSteps.length === 0) {
    throw new BadRequestException('Se requiere al menos un destinatario con email válido');
  }

  // Generar tokens únicos por step (mismo patrón que create).
  const newSteps = validSteps.map((s, i) => ({
    order: i,
    recipientEmail: s.recipientEmail.trim(),
    recipientName: s.recipientName?.trim() || s.recipientEmail.trim(),
    token: crypto.randomUUID(),
    status: 'pending' as const,
    formData: {},
  }));
  task.steps = newSteps as any;
  await task.save();

  // Dispara correo al primer destinatario (mismo patrón que create actual).
  await this.sendStepEmail(task, 0);
  return { ok: true, sentCount: newSteps.length };
}
```

Agregar los imports si faltan al inicio del archivo:
```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

- [ ] **Step 3: Agregar endpoint `POST :id/send` en `TasksController`**

En `backend/src/tasks/tasks.controller.ts`, después del bloque `@Patch(':id/cancel')`:

```ts
@UseGuards(JwtAuthGuard)
@Post(':id/send')
async sendTask(
  @Param('id') id: string,
  @Body() body: { steps?: Array<{ recipientEmail: string; recipientName?: string }> },
  @Req() req: AuthedRequest,
): Promise<{ ok: true; sentCount: number }> {
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuario no autenticado');
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  return this.tasksService.sendTask(id, steps, user.id);
}
```

Verificar que `UnauthorizedException` esté en el import de `@nestjs/common`; agregar si falta.

- [ ] **Step 4: Build backend + verificar ruta**

```powershell
cd backend
npm run build
```
Expected: 0 errores.

Opcional (si tienes el backend corriendo): reiniciar y confirmar en el log:
```powershell
Select-String -Path 'C:\proyectos\Soulmedical\backend\logs\backend-*.log' -Pattern 'tasks/:id/send|tasks/:id/send, POST' | Select-Object -Last 3 | ForEach-Object { $_.Line }
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.controller.ts
git commit -m "feat(tasks): POST /:id/send para flujo 2-pasos + relajar validacion de create

- create() acepta steps: [] sin lanzar BadRequestException; si viene vacio
  no se dispara sendStepEmail. Compatible con clientes que aun envian steps.
- Nuevo sendTask(taskId, steps, userId) con:
  - Ownership check (task.createdById === userId, 403 si no)
  - Idempotencia: 409 si task.steps.length > 0 (previene doble envio)
  - Valida al menos 1 email valido
  - Genera tokens UUID por step + persiste + envia correo al primer step
- POST /api/tasks/:id/send con JWT

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 2 · Frontend

### Task 2: `StepsTab` con prop `disabled` + bloque link inline

**Files:**
- Modify: `src/components/home/taskBuilder/StepsTab.tsx`

**Interfaces:**
- Produces:
  - `StepsTab` acepta 2 nuevas props opcionales: `disabled?: boolean` y `shareLinkUrl?: string | null`
  - `disabled=true` → todos los inputs de destinatarios y botones (agregar/quitar/mover) quedan disabled vía `<fieldset disabled>`
  - Si `shareLinkUrl` existe: bloque con input readonly + botón `📋 Copiar` (usa `navigator.clipboard.writeText`)
  - Si `disabled` && no `shareLinkUrl`: placeholder "Primero crea la tarea para obtener el enlace"

- [ ] **Step 1: Extender el tipo de props**

En `src/components/home/taskBuilder/StepsTab.tsx`, agregar a `StepsTabProps`:

```ts
disabled?: boolean;
shareLinkUrl?: string | null;
```

Recibirlas en el desestructure del componente (con defaults):
```ts
function StepsTab({
  // ...props existentes,
  shareEnabled = false,
  onShareEnabledChange,
  disabled = false,
  shareLinkUrl = null,
}: StepsTabProps) {
```

- [ ] **Step 2: Envolver el bloque de destinatarios con `<fieldset disabled>`**

Localizar el JSX que renderiza la lista de steps (dropdowns de usuarios, inputs email/nombre, botones + / - / ↑ / ↓). Envolverlo con:

```tsx
<fieldset
  disabled={disabled}
  className={disabled ? 'opacity-50 [&_input]:cursor-not-allowed [&_button]:cursor-not-allowed [&_select]:cursor-not-allowed' : ''}
>
  {/* JSX existente de la lista de destinatarios */}
</fieldset>
```

El checkbox "Generar enlace compartible" queda **fuera** del fieldset (siempre habilitado hasta que la tarea se cree, después queda locked porque el link ya se decidió).

- [ ] **Step 3: Agregar bloque link inline reemplazando el placeholder actual**

Cerca del checkbox "Generar enlace compartible" (o al final del componente antes de cerrar), agregar:

```tsx
{disabled && !shareLinkUrl && shareEnabled && (
  <div className="mt-3 rounded-[10px] border-[1.5px] border-dashed border-slate-300 bg-slate-50 p-3.5 text-[12px] text-gray-500">
    Primero haz clic en <strong>Crear tarea</strong> para generar el enlace.
  </div>
)}

{shareLinkUrl && (
  <div className="mt-3 rounded-[10px] border-[1.5px] border-emerald-200 bg-emerald-50 p-3.5">
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
        ✓
      </div>
      <div>
        <div className="text-[13px] font-bold text-emerald-900">Enlace listo</div>
        <div className="text-[11.5px] text-emerald-700">
          Cópialo y compártelo por WhatsApp, chat o donde quieras.
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={shareLinkUrl}
        onClick={(e) => (e.target as HTMLInputElement).select()}
        className="flex-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 font-mono text-[11.5px] text-gray-900"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shareLinkUrl);
          } catch (err) {
            console.error('clipboard error:', err);
          }
        }}
        className="cursor-pointer rounded-lg border-none bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white"
      >
        📋 Copiar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 5: Commit**

```powershell
git add src/components/home/taskBuilder/StepsTab.tsx
git commit -m "feat(tasks): StepsTab con prop disabled + bloque link inline

- Prop disabled aplica fieldset disabled a los inputs/botones de
  destinatarios (opacity 50 + cursor not-allowed). El checkbox 'Generar
  enlace compartible' queda fuera para poder tildarlo antes de crear.
- Prop shareLinkUrl renderiza bloque inline con input readonly + boton
  Copiar (navigator.clipboard) cuando el link existe.
- Placeholder 'Primero haz clic en Crear tarea' cuando shareEnabled esta
  tildado pero aun no hay link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: `CreateTaskModal` refactor botonera + estado taskCreated + handlers separados

**Files:**
- Modify: `src/components/home/CreateTaskModal.tsx`

**Interfaces:**
- Consumes: `POST /api/tasks` (existente, ahora acepta `steps: []`); `POST /api/tasks/:id/send` (Task 1)
- Produces: modal con flujo 2 pasos según spec

- [ ] **Step 1: Agregar estados nuevos**

Después de los estados existentes (`shareEnabled`, `shareLinkUrl`, `saving`, etc.), agregar:

```ts
const [taskCreated, setTaskCreated] = useState(false);
const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
```

- [ ] **Step 2: Separar el handler actual `handleSubmit` en dos: `handleCreate` y `handleSend`**

Reemplazar el `handleSubmit` actual con:

```ts
const handleCreate = async () => {
  if (!title.trim()) {
    setError('El título es obligatorio');
    return;
  }
  setSaving(true);
  setError('');

  // Capturar prefill actual (mismo patrón que antes)
  const finalPrefilled = { ...prefilledData };
  if (prefillFormRef.current) {
    const fd = new FormData(prefillFormRef.current);
    widgets.forEach((w) => {
      const val = collectFieldValue(fd, w.id);
      if (val) finalPrefilled[w.id] = val;
    });
  }

  try {
    const res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        formId,
        folderId,
        formName,
        widgets,
        rules,
        emailTemplate:
          folders
            .find((f) => f.id === folderId)
            ?.forms.find((fm) => fm.id === formId)?.emailTemplate ?? null,
        title,
        description,
        prefilledData: finalPrefilled,
        steps: [], // <-- vacío: se agregan luego con /send
        generateShareLink: shareEnabled,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear la tarea');
    }
    const data = await res.json();
    const taskId = data._id || data.id;
    if (!taskId) throw new Error('Respuesta sin id de tarea');

    setCreatedTaskId(taskId);
    setTaskCreated(true);
    if (data.shareLinkUrl) setShareLinkUrl(data.shareLinkUrl);
  } catch (e) {
    setError((e as Error).message);
  } finally {
    setSaving(false);
  }
};

const handleSend = async () => {
  if (!createdTaskId) return;
  const validSteps = stepsCtl.steps.filter((s) =>
    s.inputEmail.trim().includes('@'),
  );
  if (validSteps.length === 0) {
    setError('Agrega al menos un destinatario con email válido');
    return;
  }
  setSaving(true);
  setError('');
  try {
    const res = await fetch(`${API_URL}/api/tasks/${createdTaskId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        steps: validSteps.map((s) => ({
          recipientEmail: s.inputEmail.trim(),
          recipientName: s.inputName.trim() || s.inputEmail,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al enviar la tarea');
    }
    onCreated();
    onClose();
  } catch (e) {
    setError((e as Error).message);
  } finally {
    setSaving(false);
  }
};
```

Nota: `collectFieldValue` es una función que ya debe estar disponible dentro del componente (revisar; si no, copiar del patrón usado en `FormPage` — devuelve fd.getAll(name).join(',')).

- [ ] **Step 3: Envolver `InfoTab` y `PrefillTab` con `<fieldset disabled={taskCreated}>`**

En el render, buscar los wrappers de tabs y modificar los divs de Info y Prefill:

```tsx
<div style={{ display: tab === "info" ? "block" : "none" }}>
  <fieldset disabled={taskCreated} className={taskCreated ? 'opacity-70' : ''}>
    <InfoTab .../>
  </fieldset>
</div>
<div style={{ display: tab === "prefill" ? "block" : "none" }}>
  <fieldset disabled={taskCreated} className={taskCreated ? 'opacity-70' : ''}>
    <PrefillTab .../>
  </fieldset>
</div>
```

- [ ] **Step 4: Pasar props nuevas a `StepsTab`**

Modificar el `<StepsTab .../>` para pasar `disabled` y `shareLinkUrl`:

```tsx
<StepsTab
  {/* ...props existentes */}
  shareEnabled={shareEnabled}
  onShareEnabledChange={setShareEnabled}
  disabled={!taskCreated}
  shareLinkUrl={shareLinkUrl}
/>
```

- [ ] **Step 5: Refactorizar el footer con la nueva botonera condicional**

Reemplazar el bloque del footer (el `{/* Footer */}` con el navegador de tabs + botones) por:

```tsx
{/* Footer */}
<div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4">
  <div className="flex gap-2">
    {tab !== "info" && (
      <button
        onClick={goPrev}
        className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-[18px] py-2 text-[13px] font-semibold text-gray-500"
      >
        ← Anterior
      </button>
    )}
    {tab !== "steps" && (
      <button
        onClick={goNext}
        className="cursor-pointer rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50 px-[18px] py-2 text-[13px] font-semibold text-emerald-700"
      >
        Siguiente →
      </button>
    )}
  </div>
  <div className="flex gap-2.5">
    <button
      onClick={onClose}
      className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500"
    >
      Cancelar
    </button>
    {tab === "steps" && (
      <>
        <button
          onClick={handleCreate}
          disabled={saving || taskCreated}
          className="cursor-pointer rounded-lg border-none px-6 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed"
          style={{
            background: taskCreated
              ? '#10b981'
              : saving
              ? '#94a3b8'
              : 'linear-gradient(135deg,#00c2a8,#0891b2)',
          }}
        >
          {taskCreated ? '✓ Tarea creada' : saving ? 'Creando...' : 'Crear tarea'}
        </button>
        <button
          onClick={handleSend}
          disabled={saving || !taskCreated}
          className="cursor-pointer rounded-lg border-none px-6 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: !taskCreated
              ? '#94a3b8'
              : saving
              ? '#94a3b8'
              : 'linear-gradient(135deg,#00c2a8,#0891b2)',
          }}
        >
          {saving ? 'Enviando...' : '🚀 Enviar tarea'}
        </button>
      </>
    )}
  </div>
</div>
```

- [ ] **Step 6: Eliminar el modal secundario de éxito con link**

Buscar el bloque `{shareLinkUrl && ( ... )}` que renderiza el modal secundario (agregado en commit 9ae457d, aprox 30-40 líneas al final del JSX del componente). **Eliminarlo completo** — el link ahora vive inline en StepsTab.

- [ ] **Step 7: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 8: Commit**

```powershell
git add src/components/home/CreateTaskModal.tsx
git commit -m "feat(tasks): flujo 2-pasos con botones Crear tarea + Enviar tarea

Refactor CreateTaskModal:
- Nuevo estado taskCreated + createdTaskId.
- handleCreate() llama POST /api/tasks sin steps + generateShareLink;
  al exito set taskCreated=true + shareLinkUrl si aplica.
- handleSend() llama POST /api/tasks/:id/send con steps validos + dispara
  correos + cierra modal.
- Footer condicional: en tab steps muestra 'Crear tarea' (verde tras
  creado) + 'Enviar tarea' (disabled hasta creado).
- InfoTab y PrefillTab envueltos con fieldset disabled cuando taskCreated
  (no re-editables porque la tarea ya persiste).
- StepsTab recibe disabled={!taskCreated} + shareLinkUrl.
- Elimina el modal secundario de exito con link (commit 9ae457d) — ahora
  el link vive inline dentro de StepsTab.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 3 · Verificación E2E

### Task 4: Verificación manual end-to-end

- [ ] **Step 1: Reiniciar backend (PowerShell Admin)**

```powershell
cd C:\proyectos\Soulmedical\backend
.\scripts\kill-zombies.ps1
.\scripts\start-backend.ps1
```

Verificar que la ruta nueva aparece mapeada:

```powershell
Select-String -Path 'C:\proyectos\Soulmedical\backend\logs\backend-*.log' -Pattern 'tasks/:id/send' | Select-Object -Last 2 | ForEach-Object { $_.Line }
```

Expected: 1 línea `Mapped {/api/tasks/:id/send, POST}`.

- [ ] **Step 2: Ctrl+F5 en el navegador y probar el nuevo flujo**

1. Ir a un formulario → clic "Crear tarea".
2. Tab **Info**: escribir título → verificar solo `Cancelar` + `Siguiente →` en la botonera.
3. Tab **Prediligenciar**: verificar `← Anterior` + `Cancelar` + `Siguiente →`. Escribir algo, cambiar a info y volver → persiste (bug fix ya aplicado antes).
4. Tab **Destinatarios** (estado inicial):
   - Checkbox "Generar enlace compartible" ✅ habilitado
   - Inputs de destinatarios GRISES (fieldset disabled)
   - Placeholder "Primero haz clic en Crear tarea para generar el enlace" (si tildaste checkbox)
   - Botón `Crear tarea` habilitado (teal)
   - Botón `Enviar tarea` ⛔ deshabilitado (gris)
5. Clic **`Crear tarea`**:
   - Modal NO cierra
   - Botón cambia a `✓ Tarea creada` (verde) y queda deshabilitado
   - Inputs de destinatarios se habilitan (ya no grises)
   - Si tildaste checkbox: aparece bloque verde "Enlace listo" con URL + botón `📋 Copiar`
   - Botón `Enviar tarea` se habilita
   - Tabs Info y Prediligenciar quedan en solo lectura si vuelves (fieldset disabled)
6. Copiar el link → verificar en portapapeles (Ctrl+V en cualquier lado).
7. Agregar al menos 1 destinatario con correo válido.
8. Clic **`Enviar tarea`**:
   - Correo se envía al primer destinatario
   - Modal cierra
   - La tarea aparece en la lista

- [ ] **Step 3: Verificar cerrar sin enviar**

1. Abrir el modal, ir a Destinatarios, tildar checkbox link, clic `Crear tarea`.
2. Copiar el link.
3. Clic `Cancelar` (o ✕).
4. Verificar en `/reports` o en la lista de tareas que la tarea existe.
5. Abrir el link en incognito → debe funcionar (form prellenado, submit crea registro).

- [ ] **Step 4: Verificar rechazo de doble envío**

Con un token JWT en la mano (opcional), llamar el endpoint 2 veces:
```powershell
$token = "<JWT>"
$body = '{"steps":[{"recipientEmail":"test@test.com","recipientName":"Test"}]}'
# Primera llamada — OK
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/tasks/<TASK_ID>/send" -Headers @{Authorization="Bearer $token"} -ContentType "application/json" -Body $body
# Segunda llamada — 409
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/tasks/<TASK_ID>/send" -Headers @{Authorization="Bearer $token"} -ContentType "application/json" -Body $body
```

Expected: primera 200, segunda 409 Conflict "La tarea ya fue enviada".

---

## Cierre

- [ ] Todos los criterios de aceptación del spec verificados manualmente.
- [ ] `git log --oneline` muestra 3 commits del plan (Tasks 1-3).
- [ ] Backend + frontend builds clean.
