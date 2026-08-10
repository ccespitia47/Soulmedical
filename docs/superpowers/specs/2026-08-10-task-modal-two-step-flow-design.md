# Diseño · Rediseño del modal de crear tarea a flujo de 2 pasos

**Fecha:** 2026-08-10
**Autora:** moreapp.sara@gmail.com (con Claude Code / superpowers)
**Estado:** Draft — pendiente aprobación

---

## 1. Contexto y motivación

El modal actual `CreateTaskModal` mezcla en un solo botón "🚀 Crear y enviar tarea" dos acciones distintas: crear la tarea (persistir + generar shareLink si aplica) y enviar los correos a los destinatarios. Esto obliga a decidir todo en un solo momento y no permite:

- Generar el link compartible **primero**, copiarlo, y decidir luego si además se agregan destinatarios con correo.
- Iterar sobre la lista de destinatarios después de crear la tarea.
- Crear una tarea sin destinatarios (solo link) sin trucos.

La usuaria pide dividir el flujo en **dos acciones explícitas** dentro del tab Destinatarios: `Crear tarea` (persistir + generar link) y `Enviar tarea` (agregar destinatarios y disparar correos). El botón Cancelar y Anterior permanecen.

## 2. Alcance y no-alcance

**En alcance:**
- Rediseño de botonera del modal según tab activo.
- Nuevo endpoint backend `POST /api/tasks/:id/send` que recibe steps y dispara correos.
- Relajar validación de `POST /api/tasks` para permitir crear sin destinatarios.
- Estado del tab Destinatarios cambia según si la tarea ya fue creada (deshabilitado antes, habilitado después).
- Bloque de "Enlace compartible" con URL + botón Copiar movido inline al tab Destinatarios (elimina el modal secundario de éxito del commit 9ae457d).
- Cerrar sin enviar deja la tarea creada con link funcional pero sin correos.

**Fuera de alcance:**
- Endpoint "Reenviar tarea" desde la lista de tareas (feature futura si se pide — por ahora la tarea "sin enviar" solo tiene el link como canal).
- Editar título/descripción/prefill después de crear (esos tabs se pueden dejar visibles pero no re-editables; ver Sección 5.3).
- Cambios al schema `Task` (ya existe `shareLink` de la sesión anterior).
- Rediseño del tab Prefill o Info (siguen igual).

## 3. Requisitos funcionales

- **RF1.** Tab Info muestra botones: `Cancelar` · `Siguiente →`.
- **RF2.** Tab Prediligenciar muestra botones: `← Anterior` · `Cancelar` · `Siguiente →`.
- **RF3.** Tab Destinatarios muestra botones: `← Anterior` · `Cancelar` · `Crear tarea` · `Enviar tarea`.
- **RF4.** Antes de haber creado la tarea, en el tab Destinatarios:
  - Checkbox "Generar enlace compartible" habilitado.
  - Inputs de destinatarios (nombre, email, dropdown de usuarios) DESHABILITADOS (grises, no clickeables).
  - Bloque del enlace muestra placeholder: "Primero crea la tarea para obtener el enlace" (sin URL, sin botón Copiar).
  - Botón `Crear tarea` habilitado.
  - Botón `Enviar tarea` DESHABILITADO.
- **RF5.** Al clic `Crear tarea`, el frontend llama `POST /api/tasks` con el mismo body actual PERO sin `steps` (o `steps: []`). El backend crea la tarea + genera `shareLink` si el checkbox estaba tildado + devuelve `{id, shareLinkUrl}`. NO envía correos.
- **RF6.** Al recibir la response exitosa de `Crear tarea`:
  - Inputs de destinatarios se HABILITAN.
  - Si `shareLinkUrl` viene en la response, se muestra en el bloque de enlace con botón `📋 Copiar` funcional.
  - Botón `Crear tarea` cambia a `✓ Tarea creada` deshabilitado (verde).
  - Botón `Enviar tarea` se HABILITA.
  - Los tabs Info y Prediligenciar quedan en solo lectura (los campos siguen visibles pero disabled) porque la tarea ya está persistida.
- **RF7.** Al clic `Enviar tarea`, el frontend llama nuevo endpoint `POST /api/tasks/:id/send` con body `{steps: [{recipientEmail, recipientName}]}`. El backend actualiza los steps del task + dispara envío de correos + cierra el modal.
- **RF8.** Botón `Enviar tarea` requiere al menos 1 destinatario con email válido (misma validación que hoy). Si no hay, muestra error inline.
- **RF9.** Al clic `Cancelar` (o cerrar con ✕):
  - Si `Crear tarea` NO se ejecutó aún: cierra el modal sin persistir nada.
  - Si `Crear tarea` YA se ejecutó: cierra el modal. La tarea queda persistida con el link funcional; los destinatarios ingresados PERO sin enviar se descartan (no se guardan) porque nunca dispararon correos.

## 4. Requisitos no funcionales

- **RNF1. Retrocompatibilidad backend.** `POST /api/tasks` sigue aceptando `steps` opcional. Si vienen steps + `generateShareLink`, la tarea se crea con ambos (comportamiento legacy — pero el frontend nuevo no envía steps ahí).
- **RNF2. Idempotencia del send.** `POST /api/tasks/:id/send` puede llamarse una sola vez por tarea (si `task.steps.length > 0` ya, devuelve 409 Conflict). Evita duplicar correos.
- **RNF3. Auth.** `POST /api/tasks/:id/send` requiere JWT del usuario creador (o role admin) — misma política que `POST /api/tasks`.
- **RNF4. No romper flujo actual.** El endpoint `POST /api/tasks` sin cambios sigue funcionando para clientes viejos o futuros (API interna).
- **RNF5. Estado inicial visual claro.** Los destinatarios deshabilitados deben verse claramente inertes (opacity <=0.5, cursor:not-allowed en el contenedor).

## 5. Arquitectura

### 5.1 Backend

**Cambios mínimos en `TasksController`:**

- `POST /tasks` (existente): remover el check `validSteps.length === 0 → 400` en `TasksService.create`. Aceptar `steps: []`.
- Nuevo endpoint:
  ```ts
  @UseGuards(JwtAuthGuard)
  @Post(':id/send')
  async sendTask(
    @Param('id') id: string,
    @Body() body: { steps: Array<{recipientEmail: string; recipientName?: string}> },
    @Req() req: AuthedRequest,
  ) {
    return this.tasksService.sendTask(id, body.steps ?? [], req.user.id);
  }
  ```

**Nuevo método en `TasksService`:**
```ts
async sendTask(taskId: string, steps: TaskStepInput[], userId: number) {
  const task = await this.taskModel.findById(taskId);
  if (!task) throw new NotFoundException('Tarea no encontrada');
  if (task.createdById !== userId) throw new ForbiddenException(); // ownership
  if (task.steps.length > 0) throw new ConflictException('La tarea ya fue enviada'); // RNF2
  if (steps.length === 0) throw new BadRequestException('Se requiere al menos 1 destinatario');

  // Genera tokens únicos por step (reutiliza patrón de create)
  const newSteps = steps.map((s, i) => ({
    ...s,
    order: i,
    token: crypto.randomUUID(),
    status: 'pending' as const,
    formData: {},
  }));
  task.steps = newSteps;
  await task.save();

  // Dispara envío de correo al primer destinatario (mismo patrón que create actual)
  await this.sendStepEmail(task, 0);
  return { ok: true, sentCount: newSteps.length };
}
```

### 5.2 Frontend — `CreateTaskModal.tsx`

Nuevo estado:
```ts
const [taskCreated, setTaskCreated] = useState(false);
const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
```

Nuevos handlers separados:
```ts
const handleCreate = async () => {
  // POST /api/tasks sin steps + generateShareLink si tildado
  // On success: setTaskCreated(true), setCreatedTaskId(id), setShareLinkUrl(url)
};

const handleSend = async () => {
  if (!createdTaskId) return;
  // Valida steps
  // POST /api/tasks/:id/send con steps
  // On success: onCreated(); onClose();
};
```

Renderizado condicional de los botones del footer según `tab` + `taskCreated`:
- Tab === "info" || tab === "prefill": Cancelar + (Anterior si aplica) + Siguiente
- Tab === "steps" && !taskCreated: Anterior + Cancelar + `Crear tarea` (habilitado) + `Enviar tarea` (disabled)
- Tab === "steps" && taskCreated: Anterior + Cancelar + `✓ Tarea creada` (disabled) + `Enviar tarea` (habilitado)

Info y Prefill tabs cuando `taskCreated`: envueltos con un `<fieldset disabled>` para que los inputs no se puedan editar (la tarea ya está persistida).

**Eliminar** el modal secundario de éxito con link (bloque agregado en commit `9ae457d`) — ya no aplica porque el link vive inline en Destinatarios.

### 5.3 Frontend — `StepsTab.tsx`

Nueva prop `disabled?: boolean` que aplica `<fieldset disabled>` alrededor del bloque de destinatarios (incluye dropdowns, inputs de email/nombre, botones agregar/quitar/mover step).

El checkbox "Generar enlace compartible" queda FUERA del fieldset (siempre habilitado hasta que se cree la tarea; después queda locked porque el link ya se decidió).

Nueva prop `shareLinkUrl?: string | null` que renderiza en el bloque de enlace:
- Si `taskCreated` && `shareLinkUrl`: input readonly con URL + botón Copiar (mismo diseño que el modal éxito eliminado).
- Si `taskCreated` && !`shareLinkUrl`: nada (no se generó link, el checkbox estaba destildado).
- Si !`taskCreated`: placeholder "Primero crea la tarea para obtener el enlace".

### 5.4 Flujo end-to-end

```
[User en modal]                                [Backend]
      │                                             │
      │ 1. Info: Cancelar / Siguiente               │
      │ 2. Prefill: Anterior / Cancelar / Siguiente │
      │ 3. Destinatarios (inicial):                 │
      │    - Tilda "Generar enlace" (opcional)      │
      │    - Destinatarios GRISES, disabled         │
      │    - "Enviar tarea" disabled                │
      │                                             │
      │ 4. Clic "Crear tarea"                       │
      │────POST /api/tasks (sin steps)─────────────>│
      │    { generateShareLink, info, prefill }     │
      │                                             │
      │                                             │ 5. Crea Task, genera
      │                                             │    shareLink si aplica
      │                                             │
      │ 6. Response { id, shareLinkUrl }            │
      │<────────────────────────────────────────────│
      │                                             │
      │ 7. UI cambia:                               │
      │    - Destinatarios HABILITADOS              │
      │    - Link + Copiar habilitado si aplica     │
      │    - "Crear tarea" → "✓ Tarea creada"       │
      │    - "Enviar tarea" habilitado              │
      │    - Info/Prefill: fieldset disabled        │
      │                                             │
      │ 8. Usuario agrega destinatarios (opc.)      │
      │ 9. Clic "Enviar tarea"                      │
      │────POST /api/tasks/:id/send ───────────────>│
      │    { steps: [...] }                         │
      │                                             │ 10. Persiste steps
      │                                             │     + envía correo
      │                                             │     al primer step
      │ 11. Response { ok, sentCount }              │
      │<────────────────────────────────────────────│
      │                                             │
      │ 12. onCreated(); onClose();                 │
```

## 6. Criterios de aceptación

- [ ] En tab Info: botones `Cancelar` + `Siguiente →`.
- [ ] En tab Prediligenciar: `← Anterior` + `Cancelar` + `Siguiente →`.
- [ ] En tab Destinatarios (inicial): `← Anterior` + `Cancelar` + `Crear tarea` (habilitado) + `Enviar tarea` (deshabilitado).
- [ ] Destinatarios grises/deshabilitados hasta clic `Crear tarea`.
- [ ] Al clic `Crear tarea` con checkbox tildado: se crea la tarea, aparece link + botón Copiar, destinatarios se habilitan.
- [ ] Al clic `Crear tarea` con checkbox destildado: se crea la tarea, no aparece link, destinatarios se habilitan igual.
- [ ] Después de crear: `Crear tarea` cambia a `✓ Tarea creada` deshabilitado, `Enviar tarea` se habilita.
- [ ] Tabs Info y Prediligenciar quedan en solo lectura después de crear (fieldset disabled).
- [ ] Al clic `Enviar tarea` con al menos 1 destinatario válido: se dispara correo al primer step, modal cierra.
- [ ] Al clic `Enviar tarea` sin destinatarios: muestra error inline "Agrega al menos un destinatario".
- [ ] Cerrar sin dar `Enviar tarea`: tarea queda creada con link funcional, sin correos.
- [ ] Backend rechaza `POST /api/tasks/:id/send` si el task ya tiene steps (409 Conflict).
- [ ] Backend rechaza `POST /api/tasks/:id/send` si el user no es creador (403).

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Usuario crea tarea, se distrae, olvida enviar → tarea "huérfana" sin correos | Bajo (UX) | Marcarla en la lista como "Sin enviar"; feature futura de reenviar |
| Doble envío por click rápido en "Enviar tarea" | Medio | Debounce + estado `sending` que deshabilita el botón; backend RNF2 (rechaza si ya tiene steps) |
| Backend endpoint `/send` invocado con curl sin steps | Bajo | Validación en el service: `steps.length === 0 → 400` |
| Legacy: cliente viejo aún envía steps en POST /tasks | Bajo | Comportamiento retrocompat: si vienen steps, se procesan igual que antes |

## 8. Alternativas descartadas

- **Un solo botón "Crear tarea" que abre modal secundario con link**: es lo actual (commit 9ae457d). La usuaria quiere flujo lineal en el mismo modal sin modal-en-modal.
- **Sin habilitar/deshabilitar — todo editable desde el inicio y "Enviar" hace todo**: no permite ver el link antes de decidir mandar correos.
- **Botón "Crear tarea" fuera del tab (en el header)**: rompe el patrón visual de footer con acciones que ya tiene el modal.
- **Endpoint único `POST /api/tasks/:id/send-or-update-steps`**: más flexible pero se presta a mala UX (el user podría re-editar destinatarios y disparar dobles envíos). Con RNF2 (rechaza si steps ya existen) forzamos "una sola vez".

## 9. Trabajo estimado

- Backend (nuevo endpoint + service + relajar validación create): **~45 min**
- Frontend (refactor botones + estado taskCreated + handlers separados + fieldset disable + link inline): **~1 h**
- Testing E2E manual: **~15 min**
- **Total: ~2 h**

## 10. Ejecución

Modo: Subagent-Driven Development (SDD). Plan detallado se genera con `writing-plans` después de aprobar este spec.
