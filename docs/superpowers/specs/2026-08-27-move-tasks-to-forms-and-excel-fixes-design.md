# Mover panel de tareas a Formularios + fix Excel + selector campos — Design Spec

**Fecha:** 2026-08-27
**Autor:** Claude (SDD) + Sara

## Contexto

Actualmente el listado de tareas de un formulario vive en `Reports > Tareas`. Sara pide moverlo a la vista `Home > Formularios` porque conceptualmente pertenece más al contexto del formulario (administración) que al de Reports (descargas/análisis). Reports queda solo con las descargas Excel/PDF.

Adicionalmente hay 2 bugs/mejoras del flujo Excel:
1. El botón "Descargar Excel" (dentro del panel de tarea actual) queda deshabilitado tras eliminar la tarea porque `submissions.length === 0` — pero los submissions históricos siguen ahí.
2. El Excel por-tarea debería tener selección de campos (como el "Excel por correo" del ReportsPage).

## Objetivos

- Consolidar la administración de tareas (ver, reenviar, eliminar, link) en el mismo lugar donde el user gestiona el formulario.
- Reports queda enfocado en descargas.
- Permitir descargar Excel/PDF de tareas eliminadas (submissions históricos no se pierden).
- Selección de campos consistente en ambos flujos Excel.

## Alcance

**In scope:**
- Backend `GET /api/tasks/by-form/:formId?page=N&limit=20` con paginación.
- Frontend refactor: extraer `TaskInfoPanel` (accordion detalle SIN Excel/PDF) y `ExcelFieldSelector` (extraído de `ExcelReportPanel`).
- Frontend `FormsView.tsx`: click en row de formulario despliega inline listado de tareas paginado + accordion detalle.
- Frontend Reports: eliminar pestaña "Tareas", agregar pestaña "Descargas por tarea" con selector proyecto/carpeta/formulario/tarea + Excel (con selección campos) + PDF.
- Frontend: fix del `disabled` del botón Excel (relajar condición).

**Out of scope:**
- Cambiar el comportamiento de los otros botones de la card del formulario (Diligenciar, Config, Tarea, ⋯).
- Cambios al backend de submissions o excel-service.
- Rediseño visual (mantener look actual — icons, colores, tokens).
- Cambiar el flujo de creación de tareas.

## Ubicación en Home > Formularios

**Situación actual (verificada en screenshot)**: cada card de formulario tiene:
- Nombre + "Editado: DD/MM/AAAA"
- Botón **Diligenciar** (llenar)
- Botón **Config** (editor/builder)
- Botón **Tarea** (crear tarea nueva)
- Menú **⋯** (opciones)

**Comportamiento nuevo**:
- **Click en el área de la card que NO son botones** → despliega inline (accordion, misma card se extiende hacia abajo) el listado de tareas de ese formulario.
- **Los 4 botones y el menú ⋯** → sin cambio.
- Si el formulario NO tiene tareas → placeholder "Sin tareas creadas para este formulario" + botón "Crear tarea".

**Estado abierto (solo uno a la vez)**:
- `expandedFormId: string | null` en el state de `FormsView`.
- Click en la misma card → colapsa.
- Click en otra card → colapsa la anterior + expande la nueva.

## Paginación

- **20 tareas por página** hardcoded en backend y frontend.
- Flechas ← → abajo del listado.
- Contador "Página X de Y" en el centro.
- Backend responde `{ data: TaskSummaryDto[], total, page, limit }` (mismo shape que `RecordsPageDto` existente).

## Reports refactor

**Pestañas nuevas** (3 en total):
1. **Excel por correo** — sin cambio.
2. **Registros y PDFs** — sin cambio.
3. **Descargas por tarea** (nueva) — reemplaza a "Tareas" actual.

**Contenido de "Descargas por tarea"**:
- Selectores compartidos (proyecto/carpeta/formulario) — ya arriba en ReportsPage.
- Nuevo selector **tarea** — dropdown que muestra las tareas del formulario elegido.
- Al elegir tarea:
  - Botón **"Descargar Excel"** con selección de campos (reusa `ExcelFieldSelector`).
  - Botón **"Descargar todos los PDF"**.
- Sin stats, sin link, sin destinatarios, sin reenviar, sin eliminar (todo eso vive en Home ahora).

## Backend

**Cambios en `GET /api/tasks/by-form/:formId`**:
- Acepta query `page` (default 1) y `limit` (default 20, max 100).
- Retorna:
  ```ts
  {
    data: TaskSummaryDto[],
    total: number,
    page: number,
    limit: number,
  }
  ```
- Backward compat: si el frontend viejo NO manda `page`/`limit`, devuelve página 1 con 20 items (rompe si algún consumer esperaba array raw, pero solo `TasksReportPanel` actual lo usa y también se refactoriza).

**Endpoint Excel por-tarea** (verificar shape actual):
- Ya existe (usado por `TasksReportPanel.handleTaskExcel`). Verificar que acepta lista de campos `fieldIds: string[]` en el body — si no, agregarlo.

## Frontend

### Extraer 2 componentes reutilizables

**`TaskInfoPanel.tsx`** (nuevo, extraído de `TasksReportPanel`):
- Props: `detail: TaskDetailDto`, `onRefetch: () => void`, `formName: string`.
- Contenido: stats + link + destinatarios + tabla submissions (usa `SubmissionsListView` existente) + botón reenviar + botón eliminar + checkbox oneShot.
- **Sin** los botones Excel/PDF ni sus estados.
- Usado en Home (dentro del listado desplegado) y potencialmente reusable.

**`ExcelFieldSelector.tsx`** (nuevo, extraído de `ExcelReportPanel`):
- Props: `widgets: WidgetInstance[]`, `selectedFieldIds: Set<string>`, `onChange: (ids: Set<string>) => void`.
- Contenido: grid de checkboxes por widget + botones "Todos"/"Ninguno" + contador.
- Usado en `ExcelReportPanel` (existente, refactor) y en el nuevo panel "Descargas por tarea".

### `FormsView.tsx` — expandable

- Nuevo state `expandedFormId: string | null`.
- Click en la row (área sin botones) → `setExpandedFormId(f.id)`.
- Click en el mismo formulario → colapsa (`setExpandedFormId(null)`).
- Cuando expandido, renderiza `<TaskListForForm formId={f.id} formName={f.name} />` en un div abajo de la row.
- **`TaskListForForm.tsx`** (nuevo): fetch a `/tasks/by-form/:formId?page=N&limit=20` con `useState<page>`, renderiza cada tarea con accordion inline (reusa `TaskInfoPanel` al expandir), agrega paginación flechas ← →.

### `ReportsPage.tsx` — reemplazar pestaña Tareas

- `type Tab = 'excel' | 'records' | 'downloads-per-task'` (cambia `'tasks'` a `'downloads-per-task'`).
- `TABS` actualizado.
- Renderizar `<TaskDownloadsPanel formId={selectedForm.id} formName={selectedForm.name} />` cuando `tab === 'downloads-per-task'`.

### `TaskDownloadsPanel.tsx` (nuevo)

- Selector de tarea (dropdown con las tareas del formulario elegido — reusa `getFormTasksApi` con paginación).
- Al seleccionar tarea:
  - Fetch `getTaskDetailApi(taskId)` para obtener `widgets` y `submissions.length`.
  - Renderiza `<ExcelFieldSelector>` (extraído).
  - Botón "Descargar Excel" → `requestTaskExcelApi(taskId, selectedFieldIds)`.
  - Botón "Descargar todos los PDF" → `requestTaskBulkPdfApi(taskId)`.

### Fix bug Excel

**Archivo**: `TasksReportPanel.tsx` (actualmente) y `TaskDownloadsPanel.tsx` (nuevo).

**Cambio**: el botón `disabled={excelBusy || detail.submissions.length === 0}` es demasiado estricto para tareas cancelled. Fix: `disabled={excelBusy}` (siempre habilitado si no está en curso). Si el user hace click y no hay submissions, el backend responde con mensaje claro.

Alternativa: `disabled={excelBusy || (detail.submissions.length === 0 && detail.status !== 'cancelled')}` — más precisa pero más código.

Verificar backend: `TasksService.excelByTask` (o similar) — si retorna 400 cuando 0 submissions, cambiarlo a 200 con message "Sin registros para exportar".

**Nota**: Sara reportó que después de eliminar la tarea el botón queda gris. Probable causa: `TaskDetailDto.submissions` es 0 para tareas cancelled. Investigar en Task 1 si `getDetail` filtra o si el backend correctamente devuelve los submissions históricos.

## Casos edge

| Caso | Comportamiento |
|---|---|
| Formulario sin tareas | Placeholder "Sin tareas creadas" + botón "Crear tarea" (que abre el mismo modal que el botón "Tarea" de la card). |
| Usuario abre 2 formularios rápido | Solo uno expandido a la vez (colapsa el anterior). |
| Paginación con 0 tareas | No mostrar controles de paginación. |
| Reports > Descargas por tarea sin formulario elegido | Mismo `SelectPrompt` que las otras pestañas ("Elige un formulario"). |
| Reports > Descargas por tarea sin tarea elegida | Prompt "Elige una tarea" en el dropdown vacío. |
| Excel de tarea eliminada con submissions | Descarga OK (fix del bug). |
| Excel de tarea eliminada sin submissions | Backend responde 400 o 200 con "sin registros" — decidir en implementación. |

## Testing

**Backend**: jest para `listByForm` con paginación (page 1, 2, out-of-range).

**Frontend** — validación manual:
- Item 1: Home > Formularios → click en card despliega tareas paginadas. Click otra card colapsa la anterior. Accordion tarea muestra info completa.
- Item 2: Reports > Descargas por tarea → selector 4 niveles + Excel campos + PDF. Sin tab "Tareas".
- Item 3: eliminar tarea → botón Excel sigue habilitado si había submissions históricos.

## Riesgos

- **Cambio de comportamiento del click en la card**: si algún user tenía muscle memory con el click actual (asumiendo que hacía algo), va a confundirse. Mitigación: hoy el click en la card no hace nada relevante (los botones son la acción); agregar despliegue es aditivo, no rompe.
- **Extraer componentes** puede introducir bugs de props/estado. Mitigación: extracción mecánica, tests visuales manuales.
- **Backward compat paginación**: si algún otro caller espera array raw (no paginado), rompe. Grep-ear consumidores en Task 1.

## Preguntas resueltas

- Q: ¿Dónde va el listado de tareas en Home? → **Inline expandable al click de la card**.
- Q: ¿Cómo se abre el builder ahora si el click despliega tareas? → **Botón "Config" existente, sin cambio**.
- Q: ¿Descargar Excel/PDF va donde? → **En Reports (pestaña "Descargas por tarea"), NO en Home**.
- Q: ¿Selección de campos en Excel de tarea? → **Sí, reusando el UI de "Excel por correo"**.
- Q: Bug Excel — ¿escenario exacto? → **Botón deshabilitado por `submissions.length === 0` tras eliminar tarea**.
