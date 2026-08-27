# Mover panel de tareas a Formularios + fix Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Mover el panel de administración de tareas (stats, link, destinatarios, reenviar, eliminar) de Reports a Home > Formularios como accordion inline al click en la card. Reports queda con "Descargas por tarea" (Excel con selección de campos + PDF). Backend `by-form` con paginación 20/pág. Fix del botón Excel deshabilitado tras eliminar tarea.

**Architecture:** Backend gana paginación en 1 endpoint. Frontend extrae 2 componentes reutilizables (`TaskInfoPanel`, `ExcelFieldSelector`), agrega `TaskListForForm` embebido en `FormsView.tsx`, y en Reports reemplaza pestaña "Tareas" por `TaskDownloadsPanel`.

**Tech Stack:** NestJS 11 + Mongoose 9 + React 19 + TypeScript estricto + Tailwind. Sin nuevas deps.

## Global Constraints

- **NO tocar backend** más allá de la paginación de `by-form` y, si aplica, agregar `fieldIds` al endpoint Excel por-tarea (verificar en Task 1).
- **NO usar `git add -A`** — commit explícito por archivo.
- **NO commits con emojis** salvo los ya existentes.
- **Copy español** en toda UI nueva.
- **NO cambiar los botones existentes** de la card del formulario (Diligenciar, Config, Tarea, ⋯) ni el `FormPopover`.
- **Solo un formulario expandido a la vez** en `FormsView`.
- **Paginación 20 por página** hardcoded (no configurable en UI).
- **Look visual** consistente con el resto de la app (icons + colores tokens existentes).

---

### Task 1: Backend — paginación en `GET /tasks/by-form/:formId` + verificar endpoint Excel por-tarea

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts` (endpoint by-form acepta page/limit)
- Modify: `backend/src/tasks/tasks.service.ts` (`listByForm` acepta page/limit, retorna paginated shape)
- Modify: `backend/src/tasks/tasks-list.dto.ts` (nuevo tipo `TaskSummaryPageDto`)
- Modify: `backend/src/tasks/tasks-list.service.spec.ts` (tests de paginación)

**Interfaces:**
- Consumes: nada nuevo backend.
- Produces:
  ```ts
  GET /api/tasks/by-form/:formId?page=1&limit=20
    → { data: TaskSummaryDto[], total: number, page: number, limit: number }
  ```

- [ ] **Step 1: Nuevo shape en `tasks-list.dto.ts`**

Agregar:
```ts
export type TaskSummaryPageDto = {
  data: TaskSummaryDto[];
  total: number;
  page: number;
  limit: number;
};
```

- [ ] **Step 2: `listByForm` con paginación**

En `TasksService.listByForm`:
```ts
async listByForm(
  formId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<TaskSummaryPageDto> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    this.taskModel.find({ formId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    this.taskModel.countDocuments({ formId }),
  ]);

  const data: TaskSummaryDto[] = tasks.map((t) => ({
    id: t._id,
    title: t.title,
    status: t.status,
    createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
    createdByName: t.createdByName,
    totalRecipients: t.steps.length,
    completedCount: t.steps.filter((s) => s.status === 'completed').length,
    pendingCount: t.steps.filter((s) => s.status !== 'completed').length,
    hasShareLink: !!(t.shareLink?.token && t.shareLink?.enabled),
  }));

  return { data, total, page, limit };
}
```

- [ ] **Step 3: Endpoint acepta query params**

En `TasksController` (path `/tasks/by-form/:formId`):
```ts
@Get('by-form/:formId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.REPORTS_VIEW)
async listByForm(
  @Param('formId') formId: string,
  @Query('page') page = '1',
  @Query('limit') limit = '20',
): Promise<TaskSummaryPageDto> {
  return this.tasksService.listByForm(formId, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
}
```

- [ ] **Step 4: Verificar endpoint Excel por-tarea**

Grep `handleTaskExcel` en `TasksReportPanel.tsx` para saber qué endpoint llama. Verificar en el backend qué body acepta ese endpoint. Si NO acepta `fieldIds`, agregarlo (opcional en el body; si viene vacío exporta todos los campos).

Reportar en el JSON final si el endpoint requiere modificación (para que Task 4 lo asuma).

- [ ] **Step 5: Tests**

En `tasks-list.service.spec.ts`, agregar tests:
- `listByForm` con `page=1, limit=20` devuelve máximo 20 items.
- `listByForm` con `page=2` skip=20.
- `listByForm` con `limit=200` clampa a 100.
- `listByForm` con `page=0` clampa a 1.
- Shape del response tiene `data, total, page, limit`.

Actualizar tests existentes que asumen array raw a esperar `.data`.

- [ ] **Step 6: Build + tests**

```bash
cd backend
npx jest src/tasks/tasks-list.service.spec.ts
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks-list.dto.ts backend/src/tasks/tasks-list.service.spec.ts
git commit -m "feat(tasks): paginacion en GET /tasks/by-form/:formId (20 por pagina)"
```

---

### Task 2: Frontend — extraer `TaskInfoPanel` + `ExcelFieldSelector`

**Files:**
- Create: `src/components/reports/TaskInfoPanel.tsx`
- Create: `src/components/reports/ExcelFieldSelector.tsx`
- Modify: `src/pages/ReportsPage.tsx` (usar `ExcelFieldSelector` en `ExcelReportPanel`)
- Modify: `src/services/api.ts` (helper `getFormTasksApi` acepta `page`/`limit` opcionales)

**Interfaces:**
- Consumes: endpoint paginado del Task 1.
- Produces:
  - `TaskInfoPanel` (para Task 3, Home): accordion con stats + link + destinatarios + reenviar + eliminar + oneShot toggle. **SIN Excel/PDF**.
  - `ExcelFieldSelector` (para Task 4 y refactor de ExcelReportPanel).
  - `getFormTasksApi(formId, { page?, limit? })` con nuevo return shape `TaskSummaryPageDto`.

- [ ] **Step 1: Nuevo type + helper en `services/api.ts`**

```ts
export type TaskSummaryPageDto = {
  data: TaskSummaryDto[];
  total: number;
  page: number;
  limit: number;
};

export function getFormTasksApi(
  formId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ApiResponse<TaskSummaryPageDto>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<TaskSummaryPageDto>(`/tasks/by-form/${formId}${suffix}`);
}
```

**Nota**: si el `getFormTasksApi` actual devuelve `TaskSummaryDto[]` (array raw), es breaking change para `TasksReportPanel.tsx` — se refactoriza en Task 5.

- [ ] **Step 2: Extraer `TaskInfoPanel.tsx`**

Copiar de `TasksReportPanel.tsx` la lógica del **detalle expandido** (dentro de `{expandedId === t.id && detail && ...}`). Envolver en un componente independiente:

```tsx
type Props = {
  detail: TaskDetailDto;
  formName: string;
  onRefetch: () => void;   // llamado tras acciones que cambian el detail (resend, toggle oneShot, delete)
  onDelete: () => void;    // llamado cuando el user confirma delete (parent maneja el refetch de la lista)
};

export default function TaskInfoPanel({ detail, formName, onRefetch, onDelete }: Props) {
  // Todos los handlers: handleCopyLink, handleToggleShareLink, handleToggleOneShot,
  // handleResend, handleDelete (que a su vez llama onDelete).
  // NO handleTaskExcel, NO handleBulkPdf.
  // ...
}
```

**Contenido**:
- Stats (destinatarios / completados / pendientes / externos).
- Bloque link (checkbox generar + campo readonly con URL + botón copiar + checkbox oneShot).
- Tabla destinatarios (con botón Reenviar por fila).
- `<SubmissionsListView>` de submissions.
- Botón "Eliminar tarea" con `ConfirmModal`.
- Banner deleteError.

**Excluir**: los botones "Descargar Excel" y "Descargar todos los PDF" + sus estados (`excelBusy`, `bulkBusy`, `handleTaskExcel`, `handleBulkPdf`, `excelFeedback`, `bulkFeedback`).

- [ ] **Step 3: Extraer `ExcelFieldSelector.tsx`**

Copiar de `ReportsPage.tsx` `ExcelReportPanel` la lógica del grid de checkboxes:

```tsx
type Props = {
  widgets: WidgetInstance[];
  selectedFieldIds: Set<string>;
  onChange: (next: Set<string>) => void;
};

export default function ExcelFieldSelector({ widgets, selectedFieldIds, onChange }: Props) {
  // Grid de checkboxes por widget con label != vacío.
  // Botones "Todos" / "Ninguno".
  // Contador "N de M campos".
}
```

- [ ] **Step 4: Refactor `ExcelReportPanel` en `ReportsPage.tsx` para usar `ExcelFieldSelector`**

Reemplazar el bloque del grid por `<ExcelFieldSelector widgets={...} selectedFieldIds={...} onChange={...} />`. Mantener el resto (aviso de envío, botón "Solicitar reporte", feedback).

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/TaskInfoPanel.tsx src/components/reports/ExcelFieldSelector.tsx src/pages/ReportsPage.tsx src/services/api.ts
git commit -m "refactor(reports): extraer TaskInfoPanel + ExcelFieldSelector reutilizables"
```

---

### Task 3: Frontend — click en card despliega tareas paginadas en `FormsView.tsx`

**Files:**
- Create: `src/components/home/TaskListForForm.tsx`
- Modify: `src/components/home/FormsView.tsx`

**Interfaces:**
- Consumes: `getFormTasksApi` paginado (Task 2), `TaskInfoPanel` (Task 2), `getTaskDetailApi` (existente).
- Produces: click en row de formulario → expande inline el listado + accordion.

- [ ] **Step 1: Nuevo componente `TaskListForForm.tsx`**

```tsx
type Props = {
  formId: string;
  formName: string;
};

export default function TaskListForForm({ formId, formName }: Props) {
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const LIMIT = 20;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getFormTasksApi(formId, { page, limit: LIMIT });
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? 'No se pudieron cargar las tareas');
        return;
      }
      setTasks(res.data.data);
      setTotal(res.data.total);
    };
    if (formId) load();
  }, [formId, page]);

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

  const refetchList = async () => {
    const res = await getFormTasksApi(formId, { page, limit: LIMIT });
    if (res.data) {
      setTasks(res.data.data);
      setTotal(res.data.total);
    }
  };

  const handleDeleted = () => {
    setExpandedId(null);
    setDetail(null);
    refetchList();
  };

  // Render: loading / error / empty / listado con accordion + paginacion.
  // Cada fila reusa el look del listado actual en TasksReportPanel.
  // Cuando expandido, renderiza <TaskInfoPanel detail={detail} formName={formName}
  //   onRefetch={() => refetchDetail(expandedId)} onDelete={handleDeleted} />
}
```

**Nota**: la fila resumen (título, badge status, stats numéricos, chevron) copia el look de `TasksReportPanel.tsx` para consistencia visual.

**Paginación**: flechas ← → + "Página X de Y" centrado. Botones deshabilitados en extremos.

**Empty state**: si `total === 0`, mostrar placeholder "Sin tareas creadas para este formulario."

- [ ] **Step 2: Wire en `FormsView.tsx`**

Agregar state `expandedFormId: string | null` en el componente principal. En el render de cada card de formulario:

- Envolver la card en un div.
- Agregar `onClick` al área de la card que NO son botones — usar `onClick` en el div contenedor pero **NO** en los botones (que tienen su propio `onClick` con `stopPropagation`).
- Después de la card, si `expandedFormId === form.id`, renderizar `<TaskListForForm formId={form.id} formName={form.name} />`.

**Cuidado**: los botones existentes (Diligenciar, Config, Tarea, ⋯) tienen su propio onClick. Al agregar onClick a la card padre, propagación puede dispararlos. Solución: cada botón hace `e.stopPropagation()` en su onClick antes de la acción real. Verificar que no rompan.

Ejemplo (esqueleto):
```tsx
<div
  onClick={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
  className="cursor-pointer ..."
>
  {/* Contenido card actual, sin cambios */}
  <button
    onClick={(e) => { e.stopPropagation(); onDiligenciar(form); }}
    ...
  >
    Diligenciar
  </button>
  {/* ... otros botones con stopPropagation */}
</div>
{expandedFormId === form.id && (
  <TaskListForForm formId={form.id} formName={form.name} />
)}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add src/components/home/TaskListForForm.tsx src/components/home/FormsView.tsx
git commit -m "feat(home): click en formulario despliega listado paginado de tareas"
```

---

### Task 4: Frontend — nueva pestaña "Descargas por tarea" en Reports

**Files:**
- Create: `src/components/reports/TaskDownloadsPanel.tsx`
- Modify: `src/pages/ReportsPage.tsx` (agregar pestaña + wire)
- Modify: `src/services/api.ts` (helper `requestTaskExcelApi` con `fieldIds` si falta)

**Interfaces:**
- Consumes: `getFormTasksApi` paginado, `getTaskDetailApi`, `requestTaskExcelApi`, `requestTaskBulkPdfApi`, `ExcelFieldSelector`.
- Produces: nueva pestaña "Descargas por tarea" en Reports.

- [ ] **Step 1: Actualizar `requestTaskExcelApi` si falta `fieldIds`**

Verificar en `services/api.ts` la signatura actual del helper Excel por-tarea. Si no acepta `fieldIds`, agregarlo:
```ts
export function requestTaskExcelApi(taskId: string, fieldIds?: string[]) {
  return request<{ ok: boolean; message: string }>(
    `/tasks/${taskId}/excel`,   // path exacto del endpoint actual
    {
      method: 'POST',
      body: JSON.stringify({ fieldIds: fieldIds ?? [] }),
    },
  );
}
```

**Confirmar path del endpoint** con Task 1 (que lo verificó).

- [ ] **Step 2: Crear `TaskDownloadsPanel.tsx`**

```tsx
type Props = {
  formId: string;
  formName: string;
};

export default function TaskDownloadsPanel({ formId, formName }: Props) {
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [excelBusy, setExcelBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // Cargar todas las tareas del form (sin paginar aca para el dropdown; usar
  // limit alto — 100 — o hacer fetch de todas paginado si es necesario).
  useEffect(() => {
    if (!formId) return;
    getFormTasksApi(formId, { page: 1, limit: 100 }).then((res) => {
      if (res.data) setTasks(res.data.data);
    });
  }, [formId]);

  // Cuando cambia selectedTaskId, cargar detail para obtener widgets.
  useEffect(() => {
    if (!selectedTaskId) {
      setDetail(null);
      return;
    }
    getTaskDetailApi(selectedTaskId).then((res) => {
      if (res.data) {
        setDetail(res.data);
        // Preseleccionar todos los campos por defecto.
        const widgets = res.data.widgets ?? [];
        const fieldIds = new Set(widgets.filter((w: any) => w.label?.trim()).map((w: any) => w.id as string));
        setSelectedFieldIds(fieldIds);
      }
    });
  }, [selectedTaskId]);

  const handleExcel = async () => {
    if (!selectedTaskId) return;
    setExcelBusy(true);
    setFeedback(null);
    const res = await requestTaskExcelApi(selectedTaskId, Array.from(selectedFieldIds));
    setExcelBusy(false);
    if (res.error) return setFeedback({ kind: 'err', msg: res.error });
    setFeedback({ kind: 'ok', msg: res.data?.message ?? 'Excel enviado por correo.' });
  };

  const handleBulkPdf = async () => {
    // similar
  };

  // Render: dropdown de tareas + (si tarea elegida) ExcelFieldSelector + 2 botones + feedback.
}
```

**IMPORTANTE**: verificar si `TaskDetailDto` incluye `widgets` (para el selector). Si NO, agregarlo al DTO backend y refetchar; o usar un endpoint separado para obtener los widgets del formulario.

Alternativa más simple: obtener `widgets` desde el store de formularios frontend (`useFolderStore` → folder → forms → widgets). El form seleccionado ya está en el ReportsPage — pasar `selectedForm.widgets` como prop al `TaskDownloadsPanel`.

**Decidir en implementación**: prop `widgets: WidgetInstance[]` desde el parent es más limpio (evita nueva query backend).

- [ ] **Step 3: Wire en `ReportsPage.tsx`**

Agregar en `TABS`:
```ts
{ id: 'downloads-per-task' as Tab, icon: 'download', label: 'Descargas por tarea' },
```

Actualizar `Tab` union: `'excel' | 'records' | 'downloads-per-task'`.

Renderizado condicional:
```tsx
{tab === 'downloads-per-task' && selectedForm && (
  <TaskDownloadsPanel formId={selectedForm.id} formName={selectedForm.name} widgets={selectedForm.widgets ?? []} />
)}
{tab === 'downloads-per-task' && !selectedForm && <SelectPrompt />}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/TaskDownloadsPanel.tsx src/pages/ReportsPage.tsx src/services/api.ts
git commit -m "feat(reports): pestana Descargas por tarea (Excel con seleccion + PDF)"
```

---

### Task 5: Frontend — eliminar pestaña "Tareas" actual + fix disabled del Excel

**Files:**
- Modify: `src/pages/ReportsPage.tsx` (remover pestaña 'tasks' y su render)
- Delete: `src/components/reports/TasksReportPanel.tsx` (ya no se usa)
- Modify: `src/components/home/TaskListForForm.tsx` (fix bug: el `disabled` del Excel botón dentro del `TaskInfoPanel` reusado — ver Task 2)

**Interfaces:**
- Consumes: refactors del Task 2 y wire del Task 4.
- Produces: Reports ya no tiene pestaña 'tasks'; `TasksReportPanel.tsx` eliminado.

- [ ] **Step 1: Remover pestaña 'tasks' en ReportsPage**

En `ReportsPage.tsx`:
- Remover `{ id: 'tasks' ... }` del array TABS.
- Cambiar `type Tab = 'excel' | 'records' | 'tasks' | 'downloads-per-task'` → `'excel' | 'records' | 'downloads-per-task'`.
- Remover el bloque `{tab === 'tasks' && ...}`.
- Remover import de `TasksReportPanel`.

- [ ] **Step 2: Eliminar `TasksReportPanel.tsx`**

```bash
git rm src/components/reports/TasksReportPanel.tsx
```

Grep primero para asegurar que ya no está importado en ningún lado:
```bash
grep -rn "TasksReportPanel" src/ --include='*.tsx' --include='*.ts'
```

Si aparece alguna referencia además de `ReportsPage.tsx` (ya limpiado en Step 1), removerla también.

- [ ] **Step 3: Fix del disabled botón Excel**

**En `TaskInfoPanel.tsx`** (creado en Task 2) — el `TaskInfoPanel` NO tiene Excel/PDF por diseño. Verificar que se eliminó correctamente.

**En `TaskDownloadsPanel.tsx`** (creado en Task 4) — el botón Excel actual sería:
```tsx
disabled={excelBusy || !selectedTaskId}
```

Ya no depende de `submissions.length`. Bug fix implícito por el rediseño.

**Adicional (defensivo)**: si el backend endpoint de Excel por-tarea rechaza cuando no hay submissions, verificar el mensaje. Si es 400, cambiar a 200 con mensaje amigable. Reportar en Task 1 si aplica y coordinar aquí.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ReportsPage.tsx src/components/reports/TasksReportPanel.tsx  # -d para el delete
git commit -m "chore(reports): eliminar pestana Tareas legacy (reemplazada por Descargas + Home)"
```

---

## Notas para el ejecutor SDD

- **Orden estricto**: 1 → 2 → 3 → 4 → 5. Task 2 depende de Task 1 (nuevo shape paginado). Task 3 depende de Task 2 (componentes extraídos). Task 4 depende de Task 2. Task 5 depende de 3 y 4.
- **Tests requeridos**: Task 1 (backend). Frontend valida por TypeScript + E2E manual.
- **Model selection**:
  - Task 1: sonnet (paginación + validación).
  - Task 2: sonnet (extracción con lógica preservada).
  - Task 3: sonnet (integración UI + wire complejo con stopPropagation).
  - Task 4: sonnet (nuevo componente + wire).
  - Task 5: haiku (limpieza mecánica).
- **Whole-branch final review** al terminar: opus.
- **E2E manual** al final:
  - Home > Formularios: click en card → despliega tareas paginadas 20/pág → click en tarea → accordion con stats+link+destinatarios+reenviar+eliminar (sin Excel/PDF).
  - Reports: verificar pestaña "Tareas" NO existe. Nueva pestaña "Descargas por tarea" → selector proyecto/carpeta/formulario/tarea → Excel campos + PDF.
  - Eliminar una tarea con submissions históricos → ir a Reports > Descargas por tarea → seleccionar esa tarea → Excel funciona.
