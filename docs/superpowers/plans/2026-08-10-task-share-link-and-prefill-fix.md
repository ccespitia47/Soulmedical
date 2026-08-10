# Task Share Link + Prefill Bug Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar campo "Generar enlace compartible" en el modal de crear tarea que emite un link público reutilizable (endpoint `/tasks/share/:token`), y arreglar el bug de prediligenciado que se borra al cambiar de tab.

**Architecture:** Backend extiende `Task` schema con `shareLink: {token, enabled}` + 2 endpoints públicos (`GET /tasks/share/:token` para hidratar el form, `POST /tasks/share/:token/submit` para persistir un `FormSubmission` normal). El token es reutilizable indefinido (no se consume al submit). Frontend agrega checkbox en `StepsTab`, muestra el link generado en un modal post-creación, y crea `TaskSharePage` público en `/tasks/share/:token`. El fix del bug de prefill cambia el condicional de tabs por `display:none` para preservar el DOM del `<form>`.

**Tech Stack:** NestJS 11 + Mongoose 9 (backend), React 19 + TypeScript + Vite + react-router-dom 7 (frontend). Reutiliza `FormBody` y widget registry existentes.

## Global Constraints

- Los endpoints `share/*` son públicos (sin `@UseGuards(JwtAuthGuard)`) porque el link se comparte por WhatsApp/chat con personas sin cuenta.
- Rate limits: `GET /tasks/share/:token` 60/min por IP; `POST /tasks/share/:token/submit` 30/min por IP.
- El token del share es UUID v4 sin información derivable.
- Cada submit desde el share crea un `FormSubmission` en Mongo — mismo shape que `/form/:folderId/:formId` — y NO consume el token.
- El fix del bug del prefill NO cambia lógica ni añade estado nuevo — solo preserva el DOM con `display:none`.
- La feature convive con destinatarios por correo. Ambos flujos son independientes.

---

## Estructura de archivos

**Modificados backend:**
- `backend/src/tasks/task.schema.ts` (agrega campo `shareLink` + índice parcial único)
- `backend/src/tasks/tasks.dto.ts` (agrega `generateShareLink: boolean` a `CreateTaskDto`)
- `backend/src/tasks/tasks.service.ts` (agrega `findByShareToken`, `submitFromShare`; extiende `create()`)
- `backend/src/tasks/tasks.controller.ts` (agrega `GET /tasks/share/:token` y `POST /tasks/share/:token/submit`)

**Modificados frontend:**
- `src/components/home/CreateTaskModal.tsx` (fix bug tabs + estado shareEnabled + modal éxito con link)
- `src/components/home/taskBuilder/StepsTab.tsx` (checkbox "Generar enlace compartible")
- `src/router/AppRouter.tsx` (nueva ruta pública `/tasks/share/:token`)

**Nuevos frontend:**
- `src/pages/TaskSharePage.tsx`
- `src/services/api.ts` — helper opcional `getTaskShareApi(token)` + `submitTaskShareApi(token, data)` (o llamar `fetch` inline en TaskSharePage, decisión de bajo nivel)

---

## FASE 1 · Backend

### Task 1: Schema Task con shareLink + índice único parcial

**Files:**
- Modify: `backend/src/tasks/task.schema.ts`

**Interfaces:**
- Produces: `Task.shareLink: { token: string; enabled: boolean } | null` con default `null`. Índice único parcial sobre `shareLink.token` para lookups en O(1) y evitar colisiones.

- [ ] **Step 1: Leer el schema actual y agregar el sub-schema + campo**

Al final de `backend/src/tasks/task.schema.ts` (o donde estén los demás sub-schemas), agregar antes del `@Schema` de Task:

```ts
@Schema({ _id: false })
export class TaskShareLink {
  @Prop({ required: true })
  token: string;

  @Prop({ default: true })
  enabled: boolean;
}

export const TaskShareLinkSchema = SchemaFactory.createForClass(TaskShareLink);
```

Y dentro de la clase `Task`, agregar (antes de `TaskSchema = SchemaFactory.createForClass(Task)`):

```ts
@Prop({ type: TaskShareLinkSchema, default: null })
shareLink: TaskShareLink | null;
```

- [ ] **Step 2: Agregar índice único parcial al final del archivo**

Justo después de `export const TaskSchema = SchemaFactory.createForClass(Task);`:

```ts
// Índice único parcial: solo tareas con shareLink.token están indexadas.
// Permite lookups rápidos por token y garantiza que no haya colisiones,
// mientras que las tareas sin link (mayoría) no ocupan slots del índice.
TaskSchema.index(
  { 'shareLink.token': 1 },
  { unique: true, partialFilterExpression: { 'shareLink.token': { $type: 'string' } } },
);
```

- [ ] **Step 3: Build backend**

```powershell
cd backend
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/tasks/task.schema.ts
git commit -m "feat(tasks): agregar campo shareLink al schema Task

Nuevo sub-schema TaskShareLink con { token: string; enabled: boolean }.
Indice unico parcial sobre shareLink.token para lookups O(1) y evitar
colisiones sin ocupar slots del indice para tareas sin link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: DTO + service — generateShareLink en create + findByShareToken + submitFromShare

**Files:**
- Modify: `backend/src/tasks/tasks.dto.ts`
- Modify: `backend/src/tasks/tasks.service.ts`

**Interfaces:**
- Consumes: `Task` schema con `shareLink` (Task 1), `FormSubmission` schema existente
- Produces:
  - `CreateTaskDto.generateShareLink?: boolean` (opcional, default false)
  - `TasksService.create()` extendido para poblar `shareLink` si el DTO lo pide
  - `TasksService.findByShareToken(token: string): Promise<TaskShareResponse>` — lanza `NotFoundException` si no existe o `enabled=false`
  - `TasksService.submitFromShare(token: string, data: Record<string,unknown>): Promise<{submissionId: string}>` — crea FormSubmission asociado al `formId` de la task, NO consume el token
  - Tipo `TaskShareResponse = { formName, widgets, rules, prefilledData }`

- [ ] **Step 1: Extender el CreateTaskDto**

En `backend/src/tasks/tasks.dto.ts`, agregar al `CreateTaskDto` el campo:

```ts
@IsBoolean()
@IsOptional()
generateShareLink?: boolean;
```

Asegurar que `IsBoolean` y `IsOptional` estén importados de `class-validator`.

- [ ] **Step 2: Extender `create()` en TasksService**

En `backend/src/tasks/tasks.service.ts`, buscar el método `create()`. En el objeto que se pasa a `new this.taskModel({...})` o `this.taskModel.create({...})`, agregar condicionalmente:

```ts
shareLink: dto.generateShareLink
  ? { token: crypto.randomUUID(), enabled: true }
  : null,
```

Si `crypto` aún no está importado, agregar `import * as crypto from 'crypto';` arriba.

- [ ] **Step 3: Agregar `findByShareToken`**

Al final de `TasksService`, agregar:

```ts
export type TaskShareResponse = {
  formName: string;
  widgets: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  prefilledData: Record<string, string>;
};

// ... dentro de la clase
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
```

(La declaración de tipo `TaskShareResponse` va antes de la clase o en un archivo tipos aparte — decisión de bajo nivel, seguir el patrón del archivo.)

- [ ] **Step 4: Agregar `submitFromShare`**

En el mismo service:

```ts
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
```

Nota: para que `submissionModel` esté disponible, el `TasksService` necesita inyectarlo. Verificar el constructor actual de `TasksService`:
- Si ya inyecta `FormSubmission` model, no cambia nada.
- Si NO, agregar `@InjectModel(FormSubmission.name) private submissionModel: Model<FormSubmissionDocument>` al constructor y agregar `MongooseModule.forFeature([{ name: FormSubmission.name, schema: FormSubmissionSchema }])` a los imports de `TasksModule`. (Verificar el módulo antes.)

- [ ] **Step 5: Build backend**

```powershell
cd backend
npm run build
```
Expected: 0 errores.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/tasks/tasks.dto.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.module.ts
git commit -m "feat(tasks): service + DTO para shareLink reutilizable

- CreateTaskDto acepta generateShareLink?: boolean opcional
- create() puebla shareLink con UUID v4 si el flag esta true
- findByShareToken(token) devuelve {formName, widgets, rules, prefilledData}
  o 404 si no existe o enabled=false
- submitFromShare(token, data) crea FormSubmission normal asociado al
  formId de la task. NO consume el token — reutilizable indefinido.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Controller endpoints públicos + response con URL

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts`

**Interfaces:**
- Consumes: `TasksService.findByShareToken`, `TasksService.submitFromShare` (Task 2), `crypto.randomUUID()` para el token si aún no se generó
- Produces:
  - `GET /tasks/share/:token` — público, devuelve `{formName, widgets, rules, prefilledData}` o 404
  - `POST /tasks/share/:token/submit` — público, recibe `{data}`, devuelve `{ok: true, submissionId}`
  - `POST /tasks` (existente) devuelve `shareLinkUrl: string | null` si `generateShareLink` fue true

- [ ] **Step 1: Extender el endpoint POST /tasks para devolver la URL del share**

En `TasksController.create()`, después de crear la task exitosamente, si `task.shareLink?.token` existe, incluir en la respuesta:

```ts
const baseUrl = process.env.PUBLIC_BASE_URL ?? '';
const shareLinkUrl = task.shareLink?.token
  ? `${baseUrl}/tasks/share/${task.shareLink.token}`
  : null;
return { ...task, shareLinkUrl };
```

(O adaptar al shape actual del retorno — leer el método `create` y agregar `shareLinkUrl` al objeto devuelto.)

- [ ] **Step 2: Agregar endpoint público GET /tasks/share/:token**

En `TasksController`, después del bloque de endpoints `/public/:token`:

```ts
@Get('share/:token')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
async getShareByToken(@Param('token') token: string) {
  return this.tasksService.findByShareToken(token);
}
```

Importar `Throttle` de `@nestjs/throttler` si no está.

- [ ] **Step 3: Agregar endpoint público POST /tasks/share/:token/submit**

```ts
@Post('share/:token/submit')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
async submitShare(
  @Param('token') token: string,
  @Body() body: { data?: Record<string, unknown> },
) {
  if (!body?.data || typeof body.data !== 'object') {
    throw new BadRequestException('Falta el campo data');
  }
  const { submissionId } = await this.tasksService.submitFromShare(token, body.data);
  return { ok: true, submissionId };
}
```

Importar `BadRequestException` de `@nestjs/common` si no está.

- [ ] **Step 4: Build backend + verificación de rutas mapeadas**

```powershell
cd backend
npm run build
```
Expected: 0 errores.

Reiniciar backend (opcional aquí, solo para inspección):
```powershell
.\scripts\kill-zombies.ps1
.\scripts\start-backend.ps1
```

Verificar en el log que aparecen mapeadas:
```powershell
Select-String -Path 'C:\proyectos\Soulmedical\backend\logs\backend-*.log' -Pattern 'tasks/share' | Select-Object -Last 5 | ForEach-Object { $_.Line }
```

Expected: 2 líneas mostrando `GET /api/tasks/share/:token` y `POST /api/tasks/share/:token/submit`.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/tasks/tasks.controller.ts
git commit -m "feat(tasks): endpoints publicos share + shareLinkUrl en response de create

- GET /api/tasks/share/:token con throttle 60/min por IP
- POST /api/tasks/share/:token/submit con throttle 30/min
- POST /api/tasks devuelve shareLinkUrl si generateShareLink fue true

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 2 · Frontend

### Task 4: Fix bug prefill — display:none en tabs

**Files:**
- Modify: `src/components/home/CreateTaskModal.tsx`

**Interfaces:**
- Sin cambios de interface — solo estructura interna del JSX

- [ ] **Step 1: Reemplazar condicional por display:none**

En `src/components/home/CreateTaskModal.tsx`, buscar el bloque `{/* Body */}` (líneas ~232-264) y reemplazar los `{tab === X && ...}` por 3 wrappers con `display`:

```tsx
{/* Body */}
<div className="flex-1 overflow-y-auto px-6 py-5">
  <div style={{ display: tab === "info" ? "block" : "none" }}>
    <InfoTab
      title={title}
      description={description}
      onChangeTitle={setTitle}
      onChangeDescription={setDescription}
    />
  </div>
  <div style={{ display: tab === "prefill" ? "block" : "none" }}>
    <PrefillTab
      ref={prefillFormRef}
      widgets={widgets}
      onChange={handlePrefillChange}
    />
  </div>
  <div style={{ display: tab === "steps" ? "block" : "none" }}>
    <StepsTab
      steps={stepsCtl.steps}
      allUsers={allUsers}
      groups={groups}
      signaturesByStep={signaturesByStep}
      showDropdown={stepsCtl.showDropdown}
      onAddStep={stepsCtl.addStep}
      onRemoveStep={stepsCtl.removeStep}
      onMoveStep={stepsCtl.moveStep}
      onChangeStepEmail={stepsCtl.setStepExternal}
      onSetShowDropdown={stepsCtl.setShowDropdownFor}
      onSelectStepUser={stepsCtl.setStepRecipient}
      onAddGroupMembers={stepsCtl.handleAddGroupMembers}
    />
  </div>
</div>
```

- [ ] **Step 2: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 3: Prueba manual del bug fix**

1. Abrir el builder de un formulario, clic "Crear tarea".
2. Ir al tab Prediligenciar, escribir "Prueba123" en un campo de texto.
3. Cambiar al tab Información, escribir cualquier cosa en el título.
4. Volver al tab Prediligenciar.
5. El campo debe seguir mostrando "Prueba123" (antes se borraba).

- [ ] **Step 4: Commit**

```powershell
git add src/components/home/CreateTaskModal.tsx
git commit -m "fix(tasks): prediligenciado no se borra al cambiar de tab

El condicional {tab === X && <TabX />} desmontaba PrefillTab al cambiar
de tab; los inputs uncontrolled del widget perdian el defaultValue.
Ahora renderizamos los 3 tabs siempre y togglea con display:none —
el DOM del <form> persiste, los valores tipeados quedan preservados.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Checkbox "Generar enlace compartible" en StepsTab + state en modal

**Files:**
- Modify: `src/components/home/CreateTaskModal.tsx`
- Modify: `src/components/home/taskBuilder/StepsTab.tsx`

**Interfaces:**
- Produces: `StepsTab` acepta 2 props nuevas opcionales `shareEnabled: boolean` y `onShareEnabledChange: (v: boolean) => void`. `CreateTaskModal` maneja el state y lo envía al backend en el POST `/tasks` como `generateShareLink`.

- [ ] **Step 1: Agregar estado en CreateTaskModal**

Después de las otras declaraciones `useState` (línea ~50), agregar:

```ts
const [shareEnabled, setShareEnabled] = useState(false);
const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Enviar generateShareLink al backend**

En `handleSubmit`, dentro del body del `fetch` POST `/api/tasks`, agregar el campo:

```ts
body: JSON.stringify({
  formId,
  folderId,
  formName,
  // ... resto de campos existentes ...
  generateShareLink: shareEnabled,
}),
```

Después de `if (!res.ok)`, leer la respuesta y guardar `shareLinkUrl`:

```ts
const responseData = await res.json();
if (responseData?.shareLinkUrl) {
  setShareLinkUrl(responseData.shareLinkUrl);
} else {
  onCreated();
  onClose();
  return;
}
// Si vino shareLinkUrl, NO cerrar el modal — mostrar el éxito con el link.
onCreated();
setSaving(false);
```

**Alternativa más limpia**: mantener el flujo actual (`onCreated();  onClose();`) y renderizar un modal secundario `<ShareLinkSuccessModal>` sobre este cuando `shareLinkUrl` no sea null. El close del modal secundario dispara `onClose()` del modal principal. Decisión de bajo nivel — elegir la que mantenga el código más simple.

- [ ] **Step 3: Pasar props a StepsTab**

En el bloque `<StepsTab ...>` (dentro del `display:none` wrapper), agregar:

```tsx
<StepsTab
  ...
  shareEnabled={shareEnabled}
  onShareEnabledChange={setShareEnabled}
/>
```

- [ ] **Step 4: Modificar StepsTab.tsx para aceptar y mostrar el checkbox**

En `src/components/home/taskBuilder/StepsTab.tsx`:

1. Agregar a las props del tipo `StepsTabProps`:

```ts
shareEnabled?: boolean;
onShareEnabledChange?: (v: boolean) => void;
```

2. Recibirlas en el componente (`function StepsTab({..., shareEnabled = false, onShareEnabledChange})`).

3. Al inicio del JSX que devuelve el componente (antes de la lista de destinatarios), agregar el bloque:

```tsx
<div className="mb-4 rounded-[10px] border-[1.5px] border-blue-200 bg-blue-50 p-3.5">
  <label className="flex cursor-pointer items-start gap-2.5">
    <input
      type="checkbox"
      checked={shareEnabled}
      onChange={(e) => onShareEnabledChange?.(e.target.checked)}
      className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-600"
    />
    <div className="flex-1">
      <div className="text-[13px] font-semibold text-blue-900">
        🔗 Generar enlace compartible
      </div>
      <div className="mt-0.5 text-[11.5px] text-blue-700">
        Además de los destinatarios por correo, genera un link único que
        podrás copiar y pegar en WhatsApp, chat o donde quieras. Cada
        llenado del link crea un registro nuevo. Útil para personas sin
        correo electrónico.
      </div>
    </div>
  </label>
</div>
```

- [ ] **Step 5: Renderizar el modal de éxito con el link cuando exista**

En `CreateTaskModal`, al final del JSX principal (antes del `</div>` de cierre del root), agregar:

```tsx
{shareLinkUrl && (
  <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-5">
    <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-600 text-xl">
          ✓
        </div>
        <div>
          <div className="text-base font-extrabold text-gray-900">Tarea creada</div>
          <div className="text-xs text-gray-500">Enlace compartible listo</div>
        </div>
      </div>
      <p className="mb-2 text-[13px] text-gray-600">
        Copia este enlace y compártelo por WhatsApp o donde quieras. Cada
        llenado crea un registro nuevo.
      </p>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          readOnly
          value={shareLinkUrl}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="flex-1 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] text-gray-900"
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(shareLinkUrl);
          }}
          className="cursor-pointer rounded-lg border-none bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white"
        >
          📋 Copiar
        </button>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => {
            setShareLinkUrl(null);
            onClose();
          }}
          className="cursor-pointer rounded-lg border-none bg-slate-800 px-5 py-2 text-[13px] font-bold text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 7: Commit**

```powershell
git add src/components/home/CreateTaskModal.tsx src/components/home/taskBuilder/StepsTab.tsx
git commit -m "feat(tasks): checkbox 'Generar enlace compartible' + modal exito con link

- StepsTab acepta shareEnabled + onShareEnabledChange, muestra un bloque
  con el checkbox arriba de la lista de destinatarios
- CreateTaskModal envia generateShareLink al backend y, si la respuesta
  incluye shareLinkUrl, renderiza modal secundario con la URL, boton
  Copiar (navigator.clipboard) y boton Cerrar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Página pública TaskSharePage + ruta

**Files:**
- Create: `src/pages/TaskSharePage.tsx`
- Modify: `src/router/AppRouter.tsx`

**Interfaces:**
- Consumes: `GET /api/tasks/share/:token` y `POST /api/tasks/share/:token/submit` (Task 3)
- Produces: página en ruta pública `/tasks/share/:token` que renderiza el formulario prellenado y persiste el submission al enviar

- [ ] **Step 1: Crear la página**

Crear `src/pages/TaskSharePage.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { widgetRegistry } from "../components/widgets/registry";
import type { WidgetInstance, FormRule } from "../types/widget.types";

const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

type ShareData = {
  formName: string;
  widgets: WidgetInstance[];
  rules: FormRule[];
  prefilledData: Record<string, string>;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ShareData }
  | { kind: "submitting" }
  | { kind: "done"; data: ShareData }; // permite refrescar

export default function TaskSharePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/tasks/share/${token}`)
      .then(async (r) => {
        if (r.status === 404) {
          setState({ kind: "error", message: "Este enlace no es válido o fue desactivado." });
          return;
        }
        if (!r.ok) {
          setState({ kind: "error", message: `Error ${r.status} al cargar el formulario.` });
          return;
        }
        const data: ShareData = await r.json();
        setState({ kind: "ready", data });
      })
      .catch(() => setState({ kind: "error", message: "No se pudo conectar con el servidor." }));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready" || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const data: Record<string, string> = {};
    state.data.widgets.forEach((w) => {
      const val = fd.get(w.id);
      if (val != null) data[w.id] = String(val);
    });
    setState({ kind: "submitting" });
    try {
      const res = await fetch(`${API_URL}/tasks/share/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setState({ kind: "done", data: state.data });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  const resetForm = () => {
    if (state.kind === "done") setState({ kind: "ready", data: state.data });
  };

  if (state.kind === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Cargando…</div>;
  }
  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-5">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-3 text-5xl">⚠️</div>
          <p className="text-[15px] font-semibold text-gray-900">{state.message}</p>
        </div>
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-5">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-3 text-5xl">✅</div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">¡Enviado!</h2>
          <p className="mb-5 text-[13px] text-gray-500">
            Puedes llenar el formulario de nuevo o cerrar la pestaña.
          </p>
          <button
            onClick={resetForm}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2 text-[13px] font-bold text-white"
          >
            Llenar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const { data } = state;
  return (
    <div className="min-h-screen bg-[#f0f4f8] px-4 py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-2xl bg-white px-6 py-7 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <h1 className="mb-6 border-b-2 border-[#00c2a8] pb-[18px] text-[22px] font-bold text-gray-900">
            {data.formName}
          </h1>
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="flex flex-col gap-[18px]">
              {data.widgets.map((widget) => {
                const RenderComponent = widgetRegistry[widget.type]?.render;
                if (!RenderComponent) return null;
                // Aplicar prefilledData vía defaultValue del widget instance.
                const widgetWithPrefill: WidgetInstance = {
                  ...widget,
                  config: {
                    ...widget.config,
                    defaultValue: data.prefilledData[widget.id] ?? widget.config?.defaultValue,
                  },
                };
                return (
                  <div key={widget.id} className="rounded-[10px] border border-slate-200 bg-gray-50 p-4">
                    <RenderComponent widget={widgetWithPrefill} />
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end border-t border-gray-200 pt-5">
              <button
                type="submit"
                disabled={state.kind === "submitting"}
                className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-6 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.kind === "submitting" ? "Enviando…" : "📤 Enviar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

Nota: la implementación usa `defaultValue` sobre `widget.config.defaultValue` para simular el prellenado. Depende de cómo cada widget respete ese campo — muchos ya lo hacen (Text, Phone, Email, Textarea). Los que no (Signature, Photo, Subform) simplemente ignorarán el prefill, que es aceptable para el MVP.

- [ ] **Step 2: Agregar ruta pública en AppRouter**

En `src/router/AppRouter.tsx`, agregar el import y la ruta:

```tsx
import TaskSharePage from "../pages/TaskSharePage";

// Dentro de <Routes>, cerca de otras rutas públicas como /f/:formId:
<Route path="/tasks/share/:token" element={<TaskSharePage />} />
```

- [ ] **Step 3: Build frontend**

```powershell
npm run build
```
Expected: 0 errores.

- [ ] **Step 4: Commit**

```powershell
git add src/pages/TaskSharePage.tsx src/router/AppRouter.tsx
git commit -m "feat(tasks): pagina publica /tasks/share/:token para enlaces compartibles

TaskSharePage renderiza el formulario prellenado (widgets, rules,
prefilledData de la tarea). Al submit crea un FormSubmission normal
via POST /api/tasks/share/:token/submit. Ruta publica en AppRouter sin
ProtectedRoute — se comparte por WhatsApp/chat con personas sin cuenta.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## FASE 3 · Verificación E2E

### Task 7: Verificación end-to-end

- [ ] **Step 1: Reiniciar backend**

PowerShell como Admin:
```powershell
cd C:\proyectos\Soulmedical\backend
.\scripts\kill-zombies.ps1
.\scripts\start-backend.ps1
```

Verificar en el log que las rutas nuevas están mapeadas:
```powershell
Select-String -Path 'C:\proyectos\Soulmedical\backend\logs\backend-*.log' -Pattern 'tasks/share' | Select-Object -Last 3 | ForEach-Object { $_.Line }
```

Expected: 2 líneas `GET /api/tasks/share/:token` y `POST /api/tasks/share/:token/submit`.

- [ ] **Step 2: Verificar fix del bug (Item 2)**

Ctrl+F5 en el navegador.
1. Ir a un folder → clic en un formulario → clic "Crear tarea".
2. Tab Prediligenciar → escribir "Prueba123" en cualquier campo texto.
3. Cambiar al tab Información → escribir cualquier cosa.
4. Volver al tab Prediligenciar → **verifica que "Prueba123" sigue ahí**.

- [ ] **Step 3: Verificar el enlace compartible (Item 1)**

Sin cambiar de modal:
1. Tab Destinatarios → tildar checkbox "Generar enlace compartible".
2. Opcionalmente agregar 1 destinatario con correo real (para verificar convivencia).
3. Clic "🚀 Crear y enviar tarea".
4. Debe aparecer el modal de éxito con la URL en un input readonly.
5. Clic "📋 Copiar" → verificar que el link está en el portapapeles (Ctrl+V en cualquier lado).
6. Clic "Cerrar" → los 2 modales se cierran.

- [ ] **Step 4: Abrir el link en incognito**

En una ventana **de incógnito** (sin sesión):
1. Pegar la URL copiada del portapapeles.
2. Verificar que el formulario aparece con los datos que rellenaste en Prediligenciar.
3. Completar los campos faltantes → clic "📤 Enviar".
4. Aparece la pantalla "✅ ¡Enviado!" con botón "Llenar de nuevo".
5. Clic "Llenar de nuevo" → el formulario reaparece prellenado con la data original.

- [ ] **Step 5: Verificar que el submission aparece en /reports**

Volver al navegador con sesión → `/reports` → tab "Registros y PDFs" → seleccionar el formulario → debe aparecer una fila nueva con el usuario "—" (anónimo) y los datos que se enviaron desde el link.

- [ ] **Step 6: Verificar el link expirado / inválido**

En incognito, abrir la URL con un token cambiado (p.ej. cambiar el último caracter):
```
https://.../tasks/share/<TOKEN_MODIFICADO>
```

Expected: pantalla "⚠️ Este enlace no es válido o fue desactivado."

---

## Cierre

- [ ] Todos los criterios de aceptación del spec verificados manualmente.
- [ ] `cd backend; npm run build` clean.
- [ ] `npm run build` (root) clean.
- [ ] `git log --oneline` muestra 6 commits del plan (Tasks 1-6).
