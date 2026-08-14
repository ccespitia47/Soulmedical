# Eliminar tarea + link de un solo llenado — Design Spec

**Fecha:** 2026-08-14
**Autor:** Claude (SDD) + Sara

## Contexto

Dos pedidos independientes sobre la pestaña Tareas en `/reports`:

1. **Botón "Eliminar tarea"**: al eliminar una tarea, los destinatarios que no la completaron dejan de recibir recordatorios (correo y cron). A nivel DB, la tarea queda en un estado terminal ("nula") diferenciado de "activa" y "completada".

2. **Link de un solo llenado**: opción por-tarea para que el share link se invalide tras el primer submit (evita que la misma persona llene el formulario dos veces con el mismo link).

## Objetivos

- Dar al admin control sobre tareas "activas" sin dejar rastros ni notificaciones colgando.
- Permitir configurar "encuestas únicas" sin tener que crear links nuevos cada vez.

## Alcance

**In scope:**
- Endpoint `PATCH /tasks/:id/cancel` (ya existe): agregar ownership check.
- `findByShareToken` / `submitFromShare`: filtrar `task.status !== 'cancelled'`.
- Schema `Task.shareLink`: agregar `oneShot: boolean` (default false).
- `POST /tasks` y `POST /tasks/:id/share-link`: aceptar `oneShot` opcional en el payload.
- `submitFromShare`: si `oneShot === true`, tras submit exitoso poner `shareLink.enabled = false`.
- `TasksReportPanel.tsx`: botón "Eliminar" con modal de confirmación + badges de status renombrados.
- `CreateTaskModal.tsx` / `StepsTab.tsx`: checkbox "Solo permitir un llenado".
- `TasksReportPanel.tsx` (detalle): mismo checkbox editable + hint cuando link ya se usó.

**Out of scope:**
- Reactivar una tarea "nula" (irreversible).
- Configurar el oneShot por-destinatario (siempre es global al share link de la tarea).
- Notificar por email al admin que la tarea fue completada / el link se agotó.
- Un-shot para el flujo chain (por-destinatario) — el chain flow YA es one-shot por su naturaleza (cada step tiene su propio token que se completa 1 vez).

## Item 1 — Eliminar tarea

### Backend

**Ownership check en `cancel`**:

En `tasks.service.ts` `cancel(id, userId)`:

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

En `tasks.controller.ts` `PATCH /:id/cancel`: pasar `Number(user.id)` al service.

**Bloqueo del share link en tareas canceladas**:

- `findByShareToken(token)`: agregar `if (task.status === 'cancelled') throw new NotFoundException('Enlace no válido o desactivado')`. Mensaje intencionalmente genérico para no revelar que la tarea existió.
- `submitFromShare(token, data)`: mismo chequeo antes de crear el submission.

**Guard rails**:
- Cron `TasksRemindersService` ya filtra `status: 'in_progress'` — cancelar detiene automáticamente.
- Flujo chain (`getByToken`, `submitStep`) ya bloquea `cancelled` (línea 208 actual).

### Frontend

**`TasksReportPanel.tsx`**:

- **Botón "Eliminar"** en cada fila de la lista, visible solo si `task.status === 'in_progress'`.
- **Badges de status** en la lista:
  - `in_progress` → badge verde "Activa"
  - `completed` → badge azul "Completada"
  - `cancelled` → badge gris "Nula"
- **Modal de confirmación** al click:
  - Título: "Eliminar tarea"
  - Cuerpo: *"¿Eliminar la tarea '{title}'? Los destinatarios que no la completaron ya no recibirán recordatorios y el enlace compartible dejará de funcionar. Esta acción no se puede deshacer."*
  - Botones: "Cancelar" (secundario) / "Eliminar" (rojo).
- Al confirmar: `PATCH /tasks/:id/cancel` → refetch lista → si la tarea estaba expandida, colapsar.
- Reusar el componente `ConfirmModal` existente (visto en `RecordsTable.tsx` para el bulk-pdf).

**Reset del panel** tras eliminar:
- Si `expandedId === taskId`, resetear a null.
- Refetch de `tasks` para actualizar los stats/badge.

## Item 2 — Link de un solo llenado

### Backend

**Schema `Task.shareLink`**:

```ts
{
  token: string;
  enabled: boolean;
  oneShot: boolean;   // NUEVO — default false
}
```

**Backward compat**: docs viejos sin `oneShot` → Mongoose devuelve `undefined` → tratar como `false`. Sin migración necesaria.

**Endpoints**:

- **`POST /tasks`** (create): acepta `generateShareLink` y **nuevo** `oneShotLink: boolean` en el body. Si `generateShareLink=true`, `shareLink.oneShot = oneShotLink === true`.
- **`POST /tasks/:id/share-link`** (toggle del Task 1 del plan anterior): extender body a `{ enabled: boolean; oneShot?: boolean }`. Si `enabled=true` y crea token nuevo, aplica `oneShot`. Si `enabled=true` y el link ya existe (idempotencia), actualiza `oneShot` solo si el body lo trae explícito.

**`submitFromShare`** — tras submit exitoso:

```ts
if (task.shareLink?.oneShot) {
  task.shareLink.enabled = false;
  await task.save();
}
```

Nota: el chequeo `oneShot` corre DESPUÉS de que el submission se persistió. Race es aceptable (2 requests simultáneas: ambas ven `enabled=true`, ambas persisten submission, luego una gana el save del `enabled=false` — el submissions duplicados son casi imposibles en la ventana de milisegundos). Si Sara lo pide después, agregar update atómico.

### Frontend

**`CreateTaskModal` / `StepsTab.tsx`**:

Debajo del checkbox "Generar enlace compartible", nuevo checkbox condicional (solo visible si `shareEnabled === true`):

```
☐ Solo permitir un llenado por link
   (Tras el primer submit, el enlace dejará de funcionar.)
```

Estado nuevo `oneShotLink: boolean` en `CreateTaskModal`. Se envía como campo `oneShotLink` en el POST `/tasks`.

**`TasksReportPanel.tsx`** — bloque link en detalle expandido:

- Mismo checkbox "Solo permitir un llenado" editable.
- Al toggle → PATCH `POST /tasks/:id/share-link { enabled: true, oneShot: newValue }`.
- Si `shareLink.enabled === false` y hubo submissions → hint gris *"Este enlace ya fue utilizado y no acepta nuevas respuestas."*.

## Errores y edge cases

| Caso | Comportamiento |
|---|---|
| Admin B intenta cancelar tarea del admin A | 403 `No autorizado`. |
| Cancelar una tarea ya `cancelled` | Idempotente: retorna la task sin cambio. |
| Cancelar mientras hay una submission share en vuelo | Race pequeño: submit puede persistir antes del status='cancelled' save. Aceptable. |
| Link oneShot + 2 submits simultáneos | Ambos persisten, uno gana el `enabled=false`. Casi imposible en práctica; documentar. |
| oneShot toggle mientras el link ya fue usado (`enabled=false`) | El PATCH del checkbox solo aplica si genera un token nuevo (enabled=true + create). Sino, ignora silenciosamente. |
| Cron corre mientras se cancela una tarea | Cron query no re-checkea status por-task antes del envío; puede enviar 1 correo residual. Aceptable (window de segundos). |

## Testing

**Backend jest**:
- `cancel`: 403 si no owner; idempotente; efectivo (task.status=cancelled).
- `submitFromShare` con `oneShot=true`: después del primer submit, segundo intento devuelve 404.
- `submitFromShare` con tarea cancelled: 404.
- `findByShareToken` con tarea cancelled: 404.

**Frontend** — validación manual:
- Crear tarea con checkbox "Solo un llenado" tildado → abrir link en 2 pestañas → primera envía OK, segunda muestra "enlace no disponible".
- Crear tarea sin oneShot → link permite N llenados.
- Eliminar tarea desde Reportes → modal, confirmar → badge "Nula" + no recibe correos.
- Otro admin intenta eliminar la misma tarea (403) → banner rojo.

## Riesgos

- **Backend cron entre cancel y siguiente ciclo**: pequeña ventana donde 1 correo residual puede enviarse. Aceptable.
- **`ConfirmModal` component**: verificar API en `RecordsTable.tsx` — se reusa tal cual.
- **Schema `oneShot` sin backfill**: Mongoose trata `undefined` como `false` en `if (task.shareLink?.oneShot)`, así que docs viejos funcionan sin migración.

## Preguntas resueltas

- Q: Nuevo valor `null`/`deleted` en DB o reusar `cancelled`? → **Reusar 'cancelled'**, badge "Nula" en UI.
- Q: OneShot global (todos los links) o por-tarea? → **Por-tarea** (toggle en CreateTaskModal + TasksReportPanel).
