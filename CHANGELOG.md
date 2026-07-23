# Changelog

Notas de los cambios realizados durante la sesión de modernización y
hardening del proyecto SoulForms. Los cambios están agrupados por tema,
no en orden cronológico, para facilitar la lectura.

---

## 🔒 Seguridad (hardening)

- **Eliminadas credenciales hardcodeadas** en `src/types/auth.types.ts`: borrados
  el arreglo `TEMP_USERS` (3 cuentas con passwords en plaintext) y la función
  `authenticateTemp()`. Eran código muerto.
- **`useUsersStore` saneado**: removidos el campo `password` del tipo `AppUser`,
  el middleware `persist` (ya no escribe usuarios ni passwords en `localStorage`)
  y todas las funciones de CRUD/auth (`authenticateUser`, `addUser`,
  `updateUser`, `deleteUser`, `toggleActive`, `updateAssignments`). El store
  ahora es solo caché en memoria hidratado desde `getUsersApi()` al montarse
  FormPage / EmailConfigPanel.
- **Migración automática** en `main.tsx`: limpia el `localStorage["soulforms-users"]`
  viejo al arrancar para no dejar passwords residuales en navegadores que ya
  usaron la app.
- **Endpoint `/api/email/send-password-reset` eliminado**: era público y no lo
  llamaba nadie. El flujo real de reset va por `auth.service.ts` invocando
  `emailService.sendPasswordReset()` internamente.
- **`/api/email/send` ahora requiere `JwtAuthGuard`**. Los flujos públicos
  (tareas vía token, password reset) no pasan por este endpoint. El cliente
  ahora envía el JWT en `Authorization: Bearer ...` desde `sendFormEmail`.
- **DOMPurify integrado** en 5 puntos de `dangerouslySetInnerHTML`:
  `ConfirmModal`, `HtmlBlock.render/preview/properties`, `PreviewModal`. Nueva
  utilidad `src/utils/sanitize.ts` con configuración que preserva `<style>`,
  atributos de tabla (`class`, `colspan`, `rowspan`) y URLs `data:`/`https:`,
  pero bloquea `<script>` y handlers JS inline.
- **Recordatorio pendiente**: rotar el `CLIENT_SECRET` de Microsoft Graph (fue
  expuesto en una conversación). Pasos en `MIGRATIONS.md`.

---

## 📋 Plantillas

- **Snapshot completo del formulario** al guardar una plantilla. El `TemplateItem`
  ahora incluye `rules` y `emailTemplate` además de `widgets`. Las plantillas
  viejas (solo widgets) siguen funcionando — los campos son opcionales.
- **`useTemplatesStore.addTemplate`** acepta y guarda `rules` y `emailTemplate`.
- **`BuilderLayout.handleSaveAsTemplate`** pasa también las reglas y la
  configuración de email del formulario actual al guardar como plantilla.
- **`UseTemplateModal`** restaura todo: widgets, reglas, configuración de email.
  Mensaje verde de confirmación: "Se copiarán X campos, Y reglas y la
  configuración de email".
- **Fix race condition crítico**: `addFormFromTemplate` en `useFolderStore` crea
  el formulario en UNA sola llamada al backend con `schema: { widgets, rules }`
  y `emailTemplate` en el body. Reemplaza el patrón frágil de
  `addForm + setTimeout(100) + saveFormWidgets` que fallaba con cualquier
  latencia y traía formularios vacíos.

---

## 📄 Generación de PDF (cliente con html2canvas + jsPDF)

- **`waitForImages(doc, 8000)`**: espera a que cada `<img>` cargue antes de
  medir altura. Sin esto las imágenes externas (logo, firmas con CORS) cargaban
  tarde y el PDF salía cortado.
- **DOCTYPE estricto al iframe**: el HTML del template se envuelve en
  `<!DOCTYPE html><html><head>…</head><body>${html}</body></html>` para forzar
  standards mode. Sin DOCTYPE el navegador entra en quirks mode y
  `scrollHeight` da valores inconsistentes.
- **Medición por `getBoundingClientRect()` de todos los descendientes**: en
  lugar de confiar en `scrollHeight`, se recorre cada elemento del DOM y se
  toma el `bottom` máximo. Garantiza que ningún elemento queda fuera del área
  capturada.
- **Padding `2px 0` en el body del iframe**: el borde superior/inferior de la
  tabla con `border-collapse: collapse` vive en pixel 0/N, y se perdía al
  pasar por html2canvas → JPEG → PDF. Los 2px lo evitan.
- **Paginación A4 portrait en milímetros**: A4 = 210 × 297 mm, margen de 5 mm,
  contenido respeta su proporción natural. Si supera una página, se reparte
  manteniendo el aspect ratio para no distorsionar entre páginas.
- **Optimización de tamaño/velocidad**: `scale: 1.5` (en lugar de 2) y JPEG
  con calidad 0.85 (en lugar de PNG). Reduce el PDF ~75% y el tiempo de render
  ~50%.
- **Bug fix de páginas en blanco**: revertido el `iframe.style.height = 5000px`
  que contaminaba `documentElement.scrollHeight` y generaba 5+ páginas vacías.
- **Mapeador visual de placeholders en HTML** (`HtmlCellMapper.tsx`):
  - Renderiza el HTML del template como vista WYSIWYG editable.
  - Pills clicables que insertan `${campo}` en la posición exacta del cursor.
  - Extrae los `<style>` antes de la edición y los reincorpora al guardar,
    garantizando que los CSS embebidos nunca se pierden por sanitización.
  - Mientras el modal está abierto, los `<style>` se inyectan en `<head>`
    para que el WYSIWYG se vea con tabla bonita, fondos verdes, etc.

---

## 📝 Formulario y prediligenciar

- **Soporte uniforme de `defaultValue` en widgets**: Textarea, Number, Select,
  Radio, Checkbox ahora respetan `widget.config.defaultValue`. Antes solo lo
  hacían Text, Phone, Date, Email. Esto hace que el prediligenciado funcione
  para todos los tipos de campo.
- **Checkbox múltiple**: parsea CSV (`a,b,c`) del prefill y marca cada opción
  que aparezca. `TaskPage` y `CreateTaskModal` usan `fd.getAll(name).join(",")`
  para soportar múltiples valores por widget.
- **Validación explícita de `required` en TaskPage**: itera widgets visibles y
  comprueba contra el valor recolectado. Cubre los casos que HTML5 no cubre
  (hidden inputs de Signature/IdScanner, widgets sin `<input>` como Photo).
  Aparece `MissingFieldsModal` con la lista de campos faltantes.
- **Validación inteligente para firmas heredadas**: si una firma asignada al
  paso 1 ya está en `previousStepsData`, el paso 2 no la pide de nuevo en la
  validación.

---

## ✍️ Firmas y tareas multi-paso

- **`assignedStep` en widget Signature**: en el panel de propiedades del
  widget Firma se asigna a un paso N (1, 2, 3...). `0` = cualquier paso.
- **Render condicional en TaskPage**:
  - `assignedStep == stepOrder` → canvas editable.
  - `assignedStep < stepOrder` → imagen read-only con etiqueta
    "✓ Firmado en un paso anterior".
  - `assignedStep > stepOrder` → oculto (no toca aún).
- **Auto-alineamiento de destinatarios en `CreateTaskModal`**:
  `signaturesByStep` se calcula desde los widgets de Firma del formulario y
  llama `ensureStepCount(maxSignatureStep)` para mostrar automáticamente una
  caja de destinatario por cada firma.
- **Etiqueta en `StepCard`**: cada tarjeta de destinatario muestra debajo un
  badge verde: "🖊️ Esta persona firmará: Firma del solicitante".
- **`Signature.render.tsx`**: si llega una firma desde un paso anterior
  (`config.defaultValue` con prefijo `data:image/`), se renderiza como `<img>`
  read-only dentro de una caja verde, NO se muestra canvas. Un `<input
  type="hidden">` reenvía el dataURL al backend.

---

## ✅ Vista de Tareas para usuarios

- **Nuevo endpoint `GET /api/tasks/my-tasks`** que devuelve tareas activas
  donde el usuario (por email) participa. Para cada tarea:
  - `myStatus`: `in_progress` (tu turno), `pending` (todavía no te toca) o
    `waiting` (ya cumpliste, esperando a alguien después).
  - `currentStepOrder`: el paso que va activo ahora.
  - `waitingForName` / `waitingForEmail`: a quién está esperando la tarea.
  - `token`: solo cuando es tu turno (no puedes abrir el formulario si no te
    toca).
- **Componente `MyTasksList`**:
  - Badges: **Tu turno** (verde), **En espera** (azul), **Pendiente** (amarillo).
  - Barra de progreso (% del flujo completado).
  - "⏳ Esperando a María" en tareas no-mías.
  - Botón "Continuar →" solo aparece cuando es tu turno.
- **Sustituida la barra lateral de `UserAppPage`** con 4 pestañas con
  contadores: Formularios, Tareas, Borradores, Enviados.

---

## 📤 Vista de Enviados / 📝 Borradores

- **Nuevo endpoint `GET /api/submissions/mine/list`** que devuelve los envíos
  del usuario logueado (filtrados por `submittedById`), paginado.
- **Componente `MySubmissionsList`**: cards verdes con nombre del formulario,
  fecha y conteo de campos.
- **Componente `MyDraftsList`**: cards amarillas de borradores con botón
  "Continuar" y "Descartar". Los borradores son por dispositivo/navegador
  (localStorage), no se sincronizan entre dispositivos.
- **Utilidad `src/utils/formDrafts.ts`** con `saveDraft`, `loadDraft`,
  `deleteDraft`, `listDrafts`. Llave: `formDraft:${userId}:${folderId}:${formId}`.
- **FormPage** ahora:
  - Restaura el borrador al montar (pinta valores en inputs vía DOM).
  - Llama `saveDraft` en cada `onChange` del formulario.
  - Llama `deleteDraft` después de enviar exitosamente.

---

## 🏷️ Asunto del correo con placeholders

- **`SubjectField` con pills**: el campo Asunto en Email Config ahora muestra
  las pills de placeholders del formulario debajo del input. Click inserta
  `${campo}` en la posición del cursor. `onMouseDown` evita perder foco al
  hacer click.
- La sustitución del asunto al enviar ya estaba implementada (frontend usa
  `replacePlaceholders`, backend de tareas usa `renderPlaceholders`).

---

## 👥 Asignaciones (proyectos, formularios, grupos)

- **Fix crítico de índice duplicado en MongoDB**: la colección
  `user_form_assignments` tenía un índice único antiguo `formId_1_userId_1`
  que rompía la primera asignación de proyecto al mismo usuario
  (`formId: null` duplicado). Se eliminó manualmente con
  `db.user_form_assignments.dropIndex("formId_1_userId_1")` y se reemplazó por
  4 partial indexes que aplican unicidad solo cuando ambos campos están
  presentes.
- **Consolidación de UI**: `AssignmentsTab` (vista Users) y
  `GroupAssignmentsPanel` (vista Groups) se refactorizaron sobre un componente
  compartido [`AssignmentTree`](src/components/common/assignmentTree/AssignmentTree.tsx)
  y un hook [`useAssignmentState`](src/components/common/assignmentTree/useAssignmentState.ts).
  Cada wrapper conserva solo su carga/guardado específico.

---

## 🛠️ Refactors de archivos grandes (>300 líneas)

| Archivo | Antes | Después |
|---|---|---|
| `HomePage.tsx` | 382 | 248 |
| `EmailConfigPanel.tsx` | 449 | 232 |
| `AssignmentsTab.tsx` | 338 | 165 |
| `GroupAssignmentsPanel.tsx` | 339 | 144 |
| `Subform.render.tsx` | 330 | 94 |
| `Subform.properties.tsx` | 561 | 113 |
| `CreateTaskModal.tsx` | 395 | 255 |

Módulos extraídos relevantes:
- `src/hooks/useHomeAssignTarget.ts`, `useHomeEntityForms.ts`.
- `src/components/home/HomeModals.tsx` (11 modales agrupados).
- `src/components/email/emailConfig/*` (7 piezas: hooks y subcomponentes).
- `src/components/widgets/subform/builder/*` y `runtime/*`.
- `src/components/home/taskBuilder/*` (5 piezas).

---

## 🐛 Bugs corregidos

- **Webcam no enviaba la tarea**: `user.id` se usaba pero el tipo declaraba
  `userId` → `Number(undefined) = NaN` → Mongoose rechazaba. Se corrigió a
  `user.id` con el tipo correcto.
- **Padding del body parser**: Excel base64 excedía 100 KB → 413 silencioso.
  Se aumentó a 50 MB en `main.ts` con `app.use(json({ limit: '50mb' }))`.
- **Reglas no sincronizaban entre navegadores**: las reglas vivían en
  `localStorage`. Se migraron a `form.schema.rules` en MongoDB.
- **TaskPage no aplicaba reglas**: arreglado end-to-end (backend schema +
  controller + service + frontend).
- **`consolidateData` borraba firmas heredadas con strings vacíos**: ahora
  filtra valores vacíos antes de asignar, así un paso posterior no pisa la
  firma de un paso anterior.

---

## 🎨 Cambios de UX/visual

- **Migración a Tailwind v4** (`@tailwindcss/vite`). Variables CSS para temas
  (`[data-theme="dark|midnight|light"]`).
- **TaskPage rediseñada** mobile-first con Tailwind responsive.
- **Texto y elementos del Builder** alineados al diseño "minimalista
  estilo Vercel".

---

## 📨 Información sobre Microsoft Graph (remitente)

Cuando una app envía correo vía Microsoft Graph con `client_credentials`,
Outlook ignora el `from.emailAddress.name` que mandemos y usa el display
name configurado en Azure AD para el buzón. Esto es una política
antispoofing y no se puede sobrescribir desde el código.

**Para cambiar el remitente que ven los destinatarios:**

1. Cambiar el display name del buzón `pspsara@sarapacientes.com` en el
   [Microsoft 365 Admin Center](https://admin.microsoft.com) → Users →
   Edit "Display name". Afecta a todos los correos del buzón.
2. O crear un buzón dedicado (ej. `forms@sarapacientes.com`) con el display
   name correcto y cambiar `SENDER_EMAIL` en el `.env` del backend.

---

## 📦 Dependencias agregadas

- `dompurify` + `@types/dompurify` para sanitización XSS de HTML inyectado.

---

## 🚀 Para deploy

Tras pull en producción ejecutar:

```powershell
npm install
npm run build
npm --prefix backend run build
pm2 restart soulforms-frontend
pm2 restart soulforms-backend
```

Si la colección `user_form_assignments` tiene el índice viejo
`formId_1_userId_1`, eliminarlo una sola vez:

```js
mongosh
> use soulformsdb
> db.user_form_assignments.dropIndex("formId_1_userId_1")
```
