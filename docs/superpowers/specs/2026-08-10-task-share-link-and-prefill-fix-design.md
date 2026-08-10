# Diseño · Enlace compartible en tareas + fix bug de prediligenciado

**Fecha:** 2026-08-10
**Autora:** moreapp.sara@gmail.com (con Claude Code / superpowers)
**Estado:** Draft — pendiente aprobación

---

## 1. Contexto y motivación

`CreateTaskModal` es un modal de 3 tabs (Información / Prediligenciar / Destinatarios) donde el admin arma una tarea de formulario. Hoy el flujo requiere destinatarios con correo — el backend manda un link único a cada uno.

Dos problemas:

**Bug (Item 2)**: si el admin rellena algunos campos en Prediligenciar y luego cambia a Información o Destinatarios para ajustar algo, al volver a Prediligenciar los campos **están vacíos**. Los datos tipeados se pierden. Reproducción 100%.

**Feature faltante (Item 1)**: hay usuarios reales sin correo electrónico (personas mayores, contexto rural, canales de WhatsApp). Hoy no hay forma de darles un link para llenar la tarea. La usuaria quiere un **enlace compartible reutilizable** que se genere junto con la tarea, se copie desde el modal, y se pueda pegar en WhatsApp/chat/donde sea. Cada llenado crea un submission independiente.

## 2. Alcance y no-alcance

**En alcance:**
- Fix del bug: prediligenciado persiste al cambiar de tab.
- Nuevo campo en `Task` schema: `shareLink: { token: string; enabled: boolean } | null`.
- 2 endpoints públicos: `GET /api/tasks/share/:token` y `POST /api/tasks/share/:token/submit`.
- UI en tab Destinatarios: checkbox "Generar enlace compartible".
- Modal de éxito post-creación de tarea muestra el link con botón "Copiar" si se generó.
- Nueva página pública `/tasks/share/:token` que renderiza el formulario prellenado.
- Cada submit desde el link crea un `FormSubmission` normal en Mongo.

**Fuera de alcance:**
- Límite de usos o fecha de expiración del link (por ahora reutilizable indefinido).
- Notificación por correo al admin cada vez que alguien llena el link.
- Revocar el link después de creado (feature futura si se pide).
- Cambiar el flujo actual de destinatarios con correo (sigue idéntico).
- Analytics del link (cuántos abrieron, cuántos completaron).

## 3. Requisitos funcionales

- **RF1.** En el tab Prediligenciar, escribir valores en los widgets y cambiar a otro tab y volver preserva los valores tipeados.
- **RF2.** En el tab Destinatarios, hay un bloque nuevo "🔗 Enlace compartible" con checkbox "Generar enlace compartible".
- **RF3.** Al crear la tarea con el checkbox tildado, la tarea se crea con `shareLink: { token: <UUID>, enabled: true }` y la respuesta incluye la URL completa (`${PUBLIC_BASE_URL}/tasks/share/<token>`).
- **RF4.** Al crear la tarea con checkbox tildado, aparece un modal/dialog de éxito con el link + botón "Copiar" + mensaje explicativo. El admin cierra manualmente.
- **RF5.** Al crear la tarea con checkbox destildado (default), no se genera link — comportamiento actual sin cambio.
- **RF6.** `GET /api/tasks/share/:token` (público, sin auth) devuelve `{formName, widgets, rules, prefilledData}` o 404 si el token no existe o `enabled=false`.
- **RF7.** `POST /api/tasks/share/:token/submit` (público, sin auth) recibe `{data}`, crea un `FormSubmission` asociado al `formId` de la tarea, y devuelve `{ok: true, submissionId}`. **NO consume el token** — el link sigue funcionando para el siguiente.
- **RF8.** La página pública `/tasks/share/:token` renderiza el formulario con `prefilledData` (widgets pre-llenados). Al enviar, muestra mensaje "Enviado. Puedes refrescar para llenar de nuevo o cerrar la pestaña."

## 4. Requisitos no funcionales

- **RNF1. Persistencia del prefill mediante DOM preservation.** El fix no debe cambiar la lógica ni añadir estado nuevo — solo evitar que React desmonte los tabs. Se togglea visibilidad con CSS `display:none`.
- **RNF2. Compatible con destinatarios existentes.** Si un admin configura destinatarios con correo Y también tilda "generar link", ambos flujos funcionan en paralelo sin interferencia.
- **RNF3. Público sin auth.** Los endpoints `share/*` son públicos porque el link se comparte por WhatsApp/chat con personas que no tienen cuenta en SoulForms.
- **RNF4. Rate limiting.** `GET /share/:token` 60/min por IP; `POST /share/:token/submit` 30/min por IP. Evita scraping y abuso.
- **RNF5. Token opaco.** El token es un UUID v4 sin información derivable (no incluye taskId, no encodea nada). Solo un lookup en Mongo lo resuelve.
- **RNF6. Sin cambios a submissions existentes.** El submission creado desde el link tiene el mismo shape que los creados desde `/form/:folderId/:formId`. Aparece en `/reports` de forma normal.
- **RNF7. Copy-to-clipboard nativo.** Usa `navigator.clipboard.writeText()` sin librerías extras.

## 5. Arquitectura

### 5.1 Schema Task (backend/src/tasks/task.schema.ts)

Nuevo campo Mongoose:

```ts
@Prop({
  type: {
    token: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  default: null,
})
shareLink: { token: string; enabled: boolean } | null;
```

Índice único parcial para lookup rápido y evitar colisiones de token:
```ts
TaskSchema.index(
  { 'shareLink.token': 1 },
  { unique: true, partialFilterExpression: { 'shareLink.token': { $type: 'string' } } },
);
```

### 5.2 Endpoints backend

En `backend/src/tasks/tasks.controller.ts`, agregar:

```
GET  /tasks/share/:token          → público, devuelve config del form + prefilledData
POST /tasks/share/:token/submit   → público, crea FormSubmission
```

Sin `@UseGuards`. `@Throttle` con los límites de RNF4.

Servicio `TasksService`:
```ts
async findByShareToken(token: string): Promise<TaskShareResponse | null>
async submitFromShare(token: string, data: Record<string, unknown>): Promise<{ok: boolean; submissionId: string}>
```

### 5.3 Frontend

**Modal `CreateTaskModal.tsx`:**
- Reemplazar los `{tab === X && ...}` por 3 `<div style={{display}}>` — persiste el DOM (fix Item 2).
- Nuevo state `shareEnabled: boolean` (default false).
- Pasar como prop al `StepsTab`.
- En `handleSubmit`, si `shareEnabled` es true, agregar `generateShareLink: true` al body del POST.
- La respuesta del POST puede incluir `shareLinkUrl`. Si viene, mostrar un modal de éxito con el link + Copiar antes de cerrar.

**Nuevo componente `ShareLinkSuccessModal.tsx`** (o inline en CreateTaskModal si es chico):
- Título: "Tarea creada"
- Muestra la URL en un `<input readonly>` seleccionable
- Botón "📋 Copiar"
- Botón "Cerrar" que cierra ambos modales

**StepsTab:**
- Nuevo bloque al inicio: card con checkbox "Generar enlace compartible" + texto explicativo.
- Callbacks `shareEnabled` / `onShareEnabledChange` pasados del parent.

**Nueva página `src/pages/TaskSharePage.tsx`:**
- Route pública `/tasks/share/:token` en `AppRouter.tsx` (SIN `ProtectedRoute`).
- `useEffect` fetch `GET /api/tasks/share/:token`.
- Si 200 → renderiza `<FormPage>` con `widgets`, `rules`, y valores iniciales de `prefilledData`. Se necesita extender `FormPage` para aceptar un modo "share" que use un submit distinto.
- Si 404 → mensaje "Enlace no válido o expirado".
- Después del submit exitoso: mensaje de agradecimiento con botón "Llenar de nuevo" que resetea el form.

**Alternativa más simple** para no tocar `FormPage`: `TaskSharePage` renderiza `<FormBody>` directamente con su propio `<form>` y handler de submit personalizado. Menos acoplado.

### 5.4 Flujo end-to-end

```
[Admin en modal]              [Backend]                [Persona sin correo]
     │                            │                          │
     │ 1. Rellena tabs, tilda     │                          │
     │    "Generar enlace"        │                          │
     │ 2. Clic "Crear y enviar"   │                          │
     │────POST /api/tasks────────>│                          │
     │    {..., generateShareLink}│                          │
     │                            │ 3. Crea Task con         │
     │                            │    shareLink: {token,    │
     │                            │      enabled:true}       │
     │ 4. Response con url        │                          │
     │<───────────────────────────│                          │
     │                            │                          │
     │ 5. Modal éxito con URL     │                          │
     │    → user copia + comparte │─────────WhatsApp────────>│
     │                            │                          │
     │                            │                          │ 6. Abre link
     │                            │<─GET /tasks/share/:token─│
     │                            │ 7. Devuelve config       │
     │                            │───────────────────────── │
     │                            │                          │ 8. Llena form
     │                            │<─POST .../submit {data}──│
     │                            │ 9. Crea FormSubmission   │
     │                            │───────────────────────── │
     │                            │                          │ 10. "Enviado"
```

## 6. Criterios de aceptación

- [ ] En el tab Prediligenciar, escribir en un campo → cambiar a Información → cambiar a Prediligenciar → el valor persiste (bug Item 2 fixed).
- [ ] Marcar checkbox "Generar enlace compartible" → crear tarea → aparece modal de éxito con URL + botón Copiar funcional.
- [ ] Sin marcar checkbox → crear tarea → comportamiento actual sin cambios (correos a destinatarios, sin modal de éxito extra).
- [ ] Abrir la URL copiada en otro navegador/incognito → el formulario aparece prellenado con los datos del prefill.
- [ ] Llenar y enviar el form desde el link → aparece submission en `/reports` para ese formulario.
- [ ] Refrescar el link después de enviar → se puede llenar de nuevo (reutilizable).
- [ ] Abrir un link con token inexistente (`/tasks/share/nonexistent`) → mensaje "Enlace no válido".
- [ ] Con destinatarios con correo + checkbox tildado → correos se envían Y link se genera en el mismo flujo.

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Link filtrado públicamente (Google indexa) — spam de submissions | Medio | Rate limit 30/min por IP; los links usan UUID v4 no adivinables; documentar que el admin puede desactivar el link con `enabled:false` (feature futura) |
| Alguien envía cientos de submissions falsas | Medio | Rate limit + auditoría eventual (fuera de alcance MVP) |
| Cambio del schema Task rompe tareas viejas | Bajo | Campo opcional con default null; las tareas actuales quedan intactas |
| El fix del display:none rompe algún efecto de tab (blur, autofocus) | Bajo | Verificar manualmente al implementar; los tabs actuales no tienen focus management especial |

## 8. Alternativas descartadas

- **Persistir prefilledData en localStorage**: no soluciona el problema del DOM desmontado, solo lo mueve; el estado ya vive en `prefilledData` del CreateTaskModal.
- **Convertir todos los inputs de widgets a controlled con `value`+`onChange`**: requiere refactor de cada widget (Text, Phone, Email, Textarea, Signature, Photo, Subform, etc.). Alcance masivo para arreglar un bug simple.
- **Auto-consumo del link (una sola vez)**: descartado — la usuaria explícitamente pidió reutilizable.
- **Notificar al admin por correo en cada llenado**: fuera de alcance, se puede agregar después si molesta.

## 9. Trabajo estimado

- Fix bug Item 2: **15 min**
- Backend (schema + 2 endpoints + service): **~1 h**
- Frontend (checkbox + modal éxito + page pública): **~1.5 h**
- Testing E2E manual: **~30 min**
- **Total: ~3 h**

## 10. Ejecución

Modo: Subagent-Driven Development (SDD). Plan detallado se genera con `writing-plans` después de aprobar este spec.
