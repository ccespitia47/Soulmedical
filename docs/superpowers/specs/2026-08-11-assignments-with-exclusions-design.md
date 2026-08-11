# Asignaciones con jerarquía + exclusiones — Design Spec

**Fecha:** 2026-08-11
**Autor:** Claude (SDD) + Sara

## Contexto

Hoy, en el panel de asignaciones (usuario o grupo), cuando se marca un **proyecto**, todas las carpetas y formularios hijos aparecen como *"incluida"/"incluido"* y **deshabilitados** en la UI. No hay forma de asignar el proyecto completo Y a la vez quitar 1 o 2 formularios puntuales.

Sara pidió: *"cuando se asigna un proyecto y una carpeta en esa parte no puedo asignarle los formularios por defecto le asigna todos los formularios y desde allí debo poder quitar o asignar formularios a alguien"*.

Traducción: los formularios dentro de una asignación de proyecto/carpeta deben quedar **editables**, no deshabilitados. Debo poder marcar la carpeta y luego desmarcar 2 forms específicos manteniendo la asignación de carpeta.

## Objetivo

Permitir asignaciones jerárquicas con **exclusiones puntuales**:
- Marcar proyecto → todos los forms del proyecto quedan asignados (auto-incluye forms nuevos que se creen después).
- Marcar carpeta → todos los forms de la carpeta quedan asignados (auto-incluye forms nuevos).
- Desmarcar un form dentro de un proyecto/carpeta asignado → ese form específico queda excluido. El resto de la asignación sigue en pie.
- Los nuevos forms creados después NO se marcan como excluidos automáticamente (heredan la asignación).

## Alcance

**In scope:**
- Extender el modelo `UserFormAssignment` con `folderId` y `excluded`.
- Cambiar la lógica de resolución "¿tiene este usuario acceso a este form?".
- Nuevo endpoint bulk para leer/guardar asignaciones (elimina el N+1 actual).
- Refactor UI: `useAssignmentState` con exclusiones, `AssignmentTree` sin `disabled`, tab de asignaciones (usuario y grupo) usa el nuevo endpoint.
- Migración: assignments existentes son compatibles (nuevos campos son opcionales con default null/false).

**Out of scope:**
- Cambios al UI de creación de proyectos/carpetas/forms.
- Notificar al usuario asignado (no hay email/notificación hoy).
- Auditoría de cambios de asignación (usar audit-service existente si trivial; si no, se posterga).

## Modelo (backend)

### Schema `UserFormAssignment` — extendido

```ts
{
  _id: string,        // UUID (sin cambios)
  formId: string | null,      // sin cambios
  projectId: string | null,   // sin cambios
  folderId: string | null,    // NUEVO — asignación de carpeta entera
  userId: number | null,      // sin cambios
  groupId: string | null,     // sin cambios
  excluded: boolean,          // NUEVO — default false; true = "quitar este formId
                              //         aunque su project/folder esté asignado"
}
```

**Reglas de integridad**:
- Un registro con `excluded=true` **debe** tener `formId` set (excluir siempre es a nivel form) y **debe** tener `userId` XOR `groupId`. `projectId`/`folderId` siempre null en exclusiones.
- Un registro positivo tiene exactamente uno de `{formId, folderId, projectId}` set (identifica el nivel) y exactamente uno de `{userId, groupId}` set (identifica el sujeto).

### Índices nuevos

Adicionales a los 4 existentes (form+user, project+user, form+group, project+group), agregar:

```
{ folderId, userId, excluded }  unique, partial: folderId string + userId number + excluded=false
{ folderId, groupId, excluded } unique, partial: folderId string + groupId string + excluded=false
{ formId, userId, excluded }    unique, partial: formId string + userId number + excluded=true
{ formId, groupId, excluded }   unique, partial: formId string + groupId string + excluded=true
```

Los índices positivos existentes (formId+userId, formId+groupId) deben filtrar `excluded: false` en su `partialFilterExpression` para no chocar con las nuevas exclusiones sobre el mismo (formId, userId).

## Lógica de resolución

Un usuario U tiene acceso al form F si:

```
positivo = existe assignment {excluded=false, userId=U} con:
             projectId = F.projectId  OR
             folderId  = F.folderId   OR
             formId    = F.id

exclusion = existe assignment {excluded=true, userId=U, formId=F.id}

acceso = positivo AND NOT exclusion
```

Igual lógica sustituyendo U por G para grupos.

Para la app del usuario final (`GET /forms/my-forms`), la resolución agrupa forms accesibles por assignments directos + assignments heredados por grupo(s) del user, menos exclusiones.

## API — endpoints

### Nuevo: bulk read/write (sufijo `/tree` para no colisionar con legacy)

```
GET /users/:id/assignments/tree
  → { projects: string[], folders: string[], forms: string[], excludedForms: string[] }

PUT /users/:id/assignments/tree
  body: { projects: string[], folders: string[], forms: string[], excludedForms: string[] }
  → { ok: true }
```

Análogo para grupos:
```
GET /groups/:id/assignments/tree
PUT /groups/:id/assignments/tree
```

El PUT es **idempotente**: reemplaza toda la config del sujeto en una sola transacción lógica. Elimina los N+1 GET+POST del flujo actual.

### Endpoints existentes

Los endpoints granulares actuales (`POST /projects/:id/assign`, `POST /forms/:id/assign`, sus DELETE, y los `/assignments` de lectura plana) se mantienen — los usa el flujo **target-first** en `HomePage.tsx` y `useHomeAssignTarget.ts` (donde desde el explorer eliges un proyecto/form y agregas users). Ese flujo NO migra en esta iteración; queda para un spec separado si se pide.

Solo `AssignmentsTab.tsx` (users) y `GroupAssignmentsPanel.tsx` (groups) migran al bulk `/tree` en esta iteración.

### Validaciones del bulk PUT

- Rechazar (400) si algún `excludedForms[i]` no está cubierto por al menos un ancestro (projectId o folderId) también en el payload. Sin ancestro, la exclusión no tiene sentido y ensucia la DB.
- Rechazar (400) si un mismo formId aparece a la vez en `forms` y `excludedForms`.
- Rechazar (400) si un projectId/folderId/formId no existe en la DB.

## Frontend

### `useAssignmentState` — nuevos sets

Agregar:
- `excludedFolders: Set<string>` (reservado para consistencia; en la UI de este spec no se usa exclusión de carpeta, solo de form, pero el estado queda listo por si se pide luego).
- `excludedForms: Set<string>`

Cambios de comportamiento:
- `toggleFolder`: quitar el early return `if (assignedProjects.has(projectId)) return;`. Si el proyecto está asignado, marcar/desmarcar carpeta muta `excludedFolders`.
- `toggleForm`: quitar el early return de proyecto/carpeta. Si el form está heredado por un ancestro asignado, mutar `excludedForms`. Si el form no tiene ancestro asignado, mutar `assignedForms` (comportamiento actual).

Nueva función helper `isFormEffectivelyAssigned(formId, folderId, projectId)`:
```ts
const inheritsFromProject = assignedProjects.has(projectId);
const inheritsFromFolder  = assignedFolders.has(folderId);
const isExcluded          = excludedForms.has(formId);
const isDirect            = assignedForms.has(formId);
return (isDirect || inheritsFromProject || inheritsFromFolder) && !isExcluded;
```

### `AssignmentTree.tsx` — cambios de UI

- **`FolderRow`**: quitar `disabled` cuando proyecto asignado. Cambiar copy de *"incluida"* a *"hereda del proyecto"*.
- **`FormRow`**: quitar `disabled`. Cambiar copy de *"incluido"* a *"hereda"*. Si está en `excludedForms`, mostrar checkbox desmarcado con un badge amber *"excluido"* y tachado en el nombre.
- **Semántica visual del check en form**:
  - Ancestro asignado + no excluido → check verde ✓ + tag "hereda".
  - Ancestro asignado + excluido → check vacío + badge "excluido" + nombre tachado.
  - Sin ancestro + directo → check verde ✓ (sin tag).
  - Sin ancestro + no directo → check vacío.

### `AssignmentsTab.tsx` (users) + `GroupAssignmentsPanel.tsx` — refactor de carga y guardado

- Reemplazar N calls a `getProjectAssignmentsApi` + `getFormAssignmentsApi` por **un solo call** al nuevo `GET /users/:id/assignments`.
- Reemplazar N calls de POST/DELETE por **un solo call** al nuevo `PUT /users/:id/assignments` con el snapshot completo.
- Efecto derivado: guardado 10-50× más rápido (dependiendo del número de forms).

## Migración

- Registros existentes: `folderId` y `excluded` reciben default `null` y `false` respectivamente al leerlos por primera vez (Mongoose los materializa). No hay data-fix migration necesaria.
- Índices nuevos se crean automáticamente por Mongoose al arrancar el backend.
- Los índices existentes deben regenerarse con `excluded:false` en el partial filter — riesgo: si un índice `{formId, userId}` unique existe sin ese filtro y agregamos una exclusión para el mismo (formId, userId), colisiona. **Necesita drop-and-recreate del índice al arrancar**.
- Recomendación: agregar un pequeño script one-shot que corra al bootstrap del módulo de forms, o documentarlo para que Sara lo dispare a mano en producción.

## Casos edge

| Caso | Comportamiento |
|---|---|
| Marcar proyecto y luego desmarcar carpeta entera | `excludedFolders` recibe la carpeta. Todos sus forms dejan de estar accesibles vía proyecto (a menos que estén en `excludedForms` — que se limpia porque ya no aplica). |
| Marcar carpeta, desmarcar 2 forms, luego desmarcar carpeta | Se limpia `excludedForms` para forms de esa carpeta (los desmarcados dejan de tener sentido) y se saca la carpeta de `assignedFolders`. |
| Marcar proyecto y form individual que ya heredaba | `assignedForms` ignora — no rompe nada. Al guardar, se persisten solo los positivos que aportan (proyecto). El `formId` directo queda como redundante en frontend pero backend lo tolera. |
| Grupo asignado a proyecto + user miembro con exclusión personal | La exclusión personal gana. `positivo(grupo)` es true, `positivo(user)` es false, `exclusion(user, form)` es true → sin acceso. |
| Un form recién creado en un proyecto/carpeta asignada | Aparece inmediatamente accesible para todos los sujetos que tengan positivo sobre ese ancestro. Sin extra sync. |

## Testing

**Backend** — specs Jest para `FormsService`:
- Resolución: positivo por proyecto, folder, form. Exclusión bloquea. Sin exclusión permite.
- Bulk PUT: idempotencia (llamar 2× con el mismo payload no crea duplicados). Rechazo 400 en exclusiones sin ancestro.
- Índices: intentar insertar duplicado positivo lanza `MongoServerError` de dup key; insertar exclusión sobre positivo existente NO colisiona.

**Frontend** — validación manual (no tests unitarios de UI en el proyecto hoy):
- Escenario A: marcar proyecto → todos los forms se ven asignados y editables.
- Escenario B: desmarcar 1 form dentro de A → aparece badge "excluido", el resto sigue asignado.
- Escenario C: guardar A+B, recargar la página → el estado persiste correctamente.
- Escenario D: crear form nuevo en el proyecto → el usuario recién guardado lo ve accesible sin re-editar asignaciones.

## Riesgos

- **Índices existentes en producción**: si ya hay data, el rebuild del índice con `partialFilterExpression` distinto necesita `dropIndex` + `createIndex` en orden. Documentarlo. Peor caso: rollback a la asignación previa (bulk endpoint escribe registros compatibles con schema viejo).
- **N+1 legacy**: mientras el bulk endpoint no esté 100% probado, los endpoints granulares siguen vivos. No hay downtime.
- **Sync entre user y sus grupos**: hoy la resolución mezcla ambos. El spec no cambia esa mezcla; solo agrega jerarquía y exclusiones dentro de cada uno.

## Preguntas resueltas

- Q: ¿Los forms nuevos en un proyecto/carpeta asignada se auto-incluyen? → **Sí** (elegido en brainstorming).
- Q: ¿Agregar `folderId` al schema? → **Sí** (elegido en brainstorming).
- Q: ¿Excluir carpeta entera hoy? → **Reservado** (estado presente, UI no lo expone en esta iteración).
