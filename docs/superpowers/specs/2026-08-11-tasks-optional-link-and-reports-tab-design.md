# Tareas: link opcional + pestaña Reportes con reenvío/recordatorios — Design Spec

**Fecha:** 2026-08-11
**Autor:** Claude (SDD) + Sara

## Contexto

Dos pedidos independientes que comparten superficie:

1. **Crear tarea sin marcar "Generar enlace"**: hoy el botón "Crear tarea" se deshabilita si no hay share ni destinatarios. Sara pide que ambos botones ("Crear tarea" y "Enviar tarea") queden siempre disponibles, y que el checkbox "Generar enlace" siga editable *después* de crear (link a posteriori).

2. **Nueva pestaña "Tareas" en Reportes**: junto a "Excel por correo" y "Registros y PDFs", agregar una 3ra pestaña que liste las tareas creadas para el formulario elegido. Al abrir una tarea, ver stats (destinatarios / completados / pendientes), reenviar recordatorios manualmente a pendientes, mostrar/generar link compartible, tabla de submissions con "Ver PDF" y "Descargar todos". Además, recordatorios automáticos 2×/día (9AM y 3PM) hasta que el destinatario responda.

## Objetivos

- Crear tareas más flexibles (sin bloqueos innecesarios).
- Ver el estado de las tareas creadas y actuar sobre ellas desde Reportes.
- Reducir olvidos de destinatarios con recordatorios automáticos.

## Alcance

**In scope:**
- Endpoint `POST /tasks/:id/share-link` (idempotente): agregar/quitar shareLink.
- Refactor `CreateTaskModal.tsx`: quitar el guard `canCreate`; checkbox editable post-create.
- Endpoint `GET /forms/:formId/tasks` (con stats de cada tarea).
- Endpoint `GET /tasks/:id/detail` (destinatarios + submissions ligadas).
- Endpoint `POST /tasks/:id/steps/:stepIndex/resend` (reenvío manual + throttle).
- Endpoint `POST /tasks/:id/bulk-pdf` (descarga masiva por taskId).
- Cron job diario 9:00 AM y 3:00 PM: recordatorios automáticos a destinatarios pendientes.
- Componente frontend `TasksReportPanel.tsx` (pestaña + detalle inline).
- 3ra pestaña "Tareas" en `ReportsPage.tsx`.

**Out of scope:**
- Editar destinatarios de una tarea ya enviada (agregar/quitar personas después del `POST /tasks/:id/send`).
- Cancelar/borrar tareas desde este panel (ya existe endpoint `PATCH /tasks/:id/cancel`).
- Configurar el horario de recordatorios por tarea (todo global 9AM y 3PM).

## Item 1 — Link opcional

### Backend

**Endpoint nuevo**:

```
POST /api/tasks/:id/share-link
  Body: { enabled: boolean }
  Guards: JwtAuthGuard + ownership (createdById === user.id o rol ADMIN)
  Response: 200 { shareLinkUrl: string | null }

  enabled=true  → si no existe shareLink, genera token + guarda { token, enabled:true }
                  si ya existe, solo asegura enabled=true
  enabled=false → shareLink = null (o { enabled:false }; ver decision)
```

**Decisión token**: al desactivar (`enabled=false`), poner `shareLink = null` (no reutilizable). Reactivar genera token nuevo. Trade-off: un usuario que había copiado el link y luego el admin desactivó → el link viejo ya no funciona (correcto, defense in depth).

**Response**: reusar la lógica de `POST /tasks` de armar `shareLinkUrl` con `APP_BASE_URL + /t/<token>`.

### Frontend

**`CreateTaskModal.tsx`**:
- Eliminar `canCreate` compuesto. Botón "Crear tarea" habilitado siempre que haya título.
- Después de `taskCreated=true`:
  - Checkbox "Generar enlace compartible" **editable** (no disabled).
  - Al toggle, llamar `POST /tasks/:createdTaskId/share-link { enabled: newValue }` y actualizar `shareLinkUrl` con la respuesta.
  - Si estaba desactivado y el user tilda → link aparece con botón copiar.
  - Si estaba activo y el user destilda → link desaparece (con confirm inline "El link dejará de funcionar. ¿Continuar?").

**Trade-off aceptado**: usuario puede crear tarea sin link ni destinatarios → tarea huérfana en DB. Antes lo bloqueábamos, ahora es responsabilidad del usuario.

## Item 2 — Pestaña "Tareas" en Reportes

### Layout

```
┌ Reportes ────────────────────────────────────────────────────────────┐
│ Header (Reportes / subtitulo)                                       │
│ Tabs: [Excel por correo] [Registros y PDFs] [Tareas ←NUEVO]         │
│ Selectores compartidos: Proyecto / Carpeta / Formulario             │
│                                                                      │
│ (contenido de la pestaña activa)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Los selectores proyecto/carpeta/formulario se mantienen arriba compartidos entre las 3 pestañas. En "Tareas" se listan las tareas del formulario seleccionado.

### Vista tareas (lista)

Tabla con columnas: `Título` | `Fecha creación` | `Estado` (in_progress / completed / cancelled) | `Destinatarios (N)` | `Completados (M / N)` | `Chevron para abrir detalle`.

Sin paginación en primera iteración (asumir <100 tareas por form; si crece, paginar después).

Vacio: "No hay tareas creadas para este formulario aún."

### Vista tarea (detalle expandido inline)

Al click en fila → panel se **expande hacia abajo en el mismo listado** (accordion), sin modal ni ruta nueva:

```
┌ [Título tarea]                                              [✕ cerrar detalle] ┐
│                                                                                 │
│ ┌ Stats ────────────────────────────────────────────┐                         │
│ │  X destinatarios   │  Y completados   │  Z pendientes  │                    │
│ └───────────────────────────────────────────────────┘                         │
│                                                                                 │
│ ┌ Enlace compartible ───────────────────────────────┐                         │
│ │  [checkbox] Generar enlace                        │                         │
│ │  https://.../t/xxxxxx  [📋 Copiar]                │  ← si hay link          │
│ └───────────────────────────────────────────────────┘                         │
│                                                                                 │
│ ┌ Destinatarios ────────────────────────────────────┐                         │
│ │  Email       │ Nombre    │ Estado    │ Acción     │                        │
│ │  a@x.com     │ Juan      │ ✓ Comp.   │ —          │                        │
│ │  b@x.com     │ Ana       │ ⏳ Pend.  │ [Reenviar] │                        │
│ └───────────────────────────────────────────────────┘                         │
│                                                                                 │
│ ┌ Registros / Submissions completadas ──────────────┐                         │
│ │  (tabla igual a RecordsTable pero filtrada por    │                         │
│ │   taskId; con Ver PDF por fila + Descargar todos) │                         │
│ └───────────────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Endpoints backend

```
GET  /api/forms/:formId/tasks
     Guards: JwtAuthGuard + REPORTS_VIEW
     Response: Array<{
       id, title, status, createdAt, createdByName,
       totalRecipients: number,
       completedCount: number,
       pendingCount: number,
       hasShareLink: boolean,
     }>
     Sort: createdAt desc

GET  /api/tasks/:id/detail
     Guards: JwtAuthGuard + REPORTS_VIEW
     Response: {
       id, title, status, createdAt, createdByName,
       shareLinkUrl: string | null,
       recipients: Array<{
         stepIndex: number,
         email: string,
         name: string,
         status: 'in_progress' | 'pending' | 'completed',
         submittedAt: string | null,
         canResend: boolean,        // false si status='completed' o rate-limited
         lastResendAt: string | null,
       }>,
       submissions: Array<RecordRowDto>,   // reusa shape existente
     }

POST /api/tasks/:id/steps/:stepIndex/resend
     Guards: JwtAuthGuard + ownership (createdById O rol ADMIN)
     Throttle: 1 vez cada 10 min por (taskId, stepIndex)
     Body: {}
     Response: 200 { ok: true, sentAt: string } o 429 { message: string }

POST /api/tasks/:id/bulk-pdf
     Guards: JwtAuthGuard + REPORTS_VIEW
     Throttle: 1 por minuto
     HttpCode: 202
     Response: { ok: true, message: 'Estamos generando ...' }
     Reusa BulkPdfService pero pasa taskId como filtro adicional
     (o construye la lista de submissionIds directamente desde la task).
```

### Cron: recordatorios automáticos

**Frecuencia**: 9:00 AM y 3:00 PM (2×/día).

**Trigger**: `@nestjs/schedule` con `@Cron('0 9,15 * * *')` (verificar que la lib esté instalada; si no, agregar).

**Lógica**:
1. Query: `tasks.find({ 'steps.status': 'in_progress' })`.
2. Para cada task, encontrar el step con `status='in_progress'` (solo 1 por tarea).
3. Si el step tiene `lastReminderAt` de menos de 5 horas, saltar (evita duplicado por reintentos).
4. Llamar `sendStepEmail(task, stepIndex)` (reusa la función existente).
5. Update `steps.[i].lastReminderAt = now`.

**Guard rails**:
- Detener recordatorios si `task.status !== 'in_progress'` (canceled/completed).
- No aplicar límite de días — Sara eligió "hasta que responda" sin cap.
- **Nuevo campo `TaskStep.lastReminderAt: Date | null`** en el schema.

### Frontend

**Componente nuevo**: `src/components/reports/TasksReportPanel.tsx`.

**Estado**:
- `tasks: TaskSummary[]` (cargado con `GET /forms/:formId/tasks` al elegir formulario).
- `expandedTaskId: string | null` (cuál está abierto).
- `detail: TaskDetail | null` (cargado con `GET /tasks/:id/detail` al expandir).
- Loading states.

**Interacciones**:
- Click en fila de tarea → cargar detail + expandir accordion.
- Toggle checkbox "Generar enlace" → `POST /tasks/:id/share-link` (reusa endpoint del item 1).
- Click "Copiar" en link → `navigator.clipboard.writeText`.
- Click "Reenviar" en fila de destinatario pendiente → `POST /tasks/:id/steps/:stepIndex/resend`. Botón muestra "Enviado ✓" 3s después.
- Click "Ver PDF" en submission → reusa `usePdfPreview` hook existente.
- Click "Descargar todos" → `POST /tasks/:id/bulk-pdf`, muestra toast "Correo con PDFs en camino".

**Reusos**:
- `RecordsTable.tsx` — extraer la tabla de submissions (con Ver PDF + paginación si aplica) a un sub-componente reutilizable. En este spec: extraer `SubmissionsListView` y usarlo también dentro de `TasksReportPanel`.
- `PdfPreviewModal.tsx` — reusar tal cual.
- Icons existentes (`Icon` component) para todos los badges.

## Datos y schema

### Cambio al schema `Task`

Agregar campo a cada step:

```ts
@Prop({ type: Date, default: null })
lastReminderAt: Date | null;
```

Backward compat: default null. No requiere migración.

### `Submission` — vínculo con `Task`

Necesito verificar si `FormSubmission` ya tiene `taskId` o similar. Si no, agregar campo. Verificación en implementación (Task 1 del plan).

## Errores y edge cases

| Caso | Comportamiento |
|---|---|
| Item 1: user destilda "Generar link" después de haberlo copiado | Confirm inline "El link dejará de funcionar. ¿Continuar?". Si acepta, backend `shareLink=null`, link viejo devuelve 404. |
| Item 1: race en toggle rápido del checkbox | Debounce 300ms o disabled durante el fetch. |
| Item 2: task sin destinatarios (creada solo con link) | Stats: 0 dest / 0 comp / 0 pend. Sección "Destinatarios" vacía con hint "Solo enlace compartible". |
| Item 2: click "Reenviar" dentro del throttle | Backend responde 429 con mensaje "Espera 8 min para reenviar de nuevo". Frontend muestra ese mensaje inline. |
| Cron: task cancelada mientras el cron corre | Query filtra por `task.status === 'in_progress'` (dentro del `sendStepEmail`), skip silencioso. |
| Cron: destinatario ya completó pero el step aún es 'in_progress' | Imposible por invariante actual, pero el cron valida `step.status === 'in_progress'` antes de enviar. |
| Cron: falla el envío de email (SMTP down) | Loggear y continuar con el siguiente step. `lastReminderAt` solo se actualiza si el envío fue exitoso. |

## Testing

**Backend** — specs Jest para:
- `POST /tasks/:id/share-link`: ownership check, toggle idempotente, link URL correcta.
- `POST /tasks/:id/steps/:stepIndex/resend`: throttle (segunda llamada en 10min → 429), completed step → 400, ownership.
- `GET /forms/:formId/tasks`: stats correctas (contar completadas vs pendientes).
- `GET /tasks/:id/detail`: shape de respuesta, canResend logic.
- Cron: `lastReminderAt` se respeta (skip si <5h).

**Frontend** — validación manual:
- Item 1: crear tarea sin nada, verificar checkbox editable, tildar → aparece link, destildar → confirma y desaparece.
- Item 2: elegir form con tareas, expandir detalle, verificar stats, reenviar → mensaje. Copiar link. Ver PDF. Descargar todos.

## Riesgos

- **Cron no arranca en dev** si el user está corriendo `nest start --watch` (verificar). En prod usa `dist/main.js` así que corre.
- **Envío de correos** requiere que `EmailService` esté configurado. Ya existe (validar credenciales SMTP).
- **Item 3 (bug records)**: el hotfix del error message ya está commiteado (`13ffb68`); investigación paralela — no bloquea items 1 y 2.

## Preguntas resueltas

- Q: Link a posteriori vs deshabilitar checkbox? → **Link a posteriori** (endpoint PATCH nuevo).
- Q: Detalle de tarea = modal / vista / accordion inline? → **Accordion inline** (misma UX que "Registros y PDFs").
- Q: Horario cron recordatorios? → **9AM y 3PM, hasta que responda, sin cap de días**.
- Q: Botón "Reenviar" = manual solo? → **Sí, con throttle 1 vez cada 10 min**.
