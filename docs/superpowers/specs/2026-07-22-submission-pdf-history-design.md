# Diseño · Historial de PDFs por envío con versionado transparente

**Fecha:** 2026-07-22
**Autora:** moreapp.sara@gmail.com (con Claude Code / superpowers)
**Estado:** Draft — pendiente aprobación

---

## 1. Contexto y motivación

Hoy el módulo de Reportes (`/reports`) solo permite descargar un Excel de los envíos por correo (link+2FA+documento). No existe forma de recuperar el **PDF individual** de cada envío ni de descargar en bloque **todos los PDFs** de un formulario.

Se agrava con un requisito de negocio: los formularios evolucionan. Un consentimiento de vacunación con formato V1 hoy puede pasar a V2 en un mes con más campos. **Los PDFs históricos deben conservar el formato de la versión con que fueron enviados** — cambiar el template no debe alterar los registros ya realizados.

La usuaria ya sentó las bases del sistema en una sesión previa (schema con `htmlSnapshot`, service con `generatePdf`/`bulkPdfEmail`, `PdfRendererService` con Puppeteer), pero quedó a mitad de camino y con bugs. Este spec cierra el diseño y corrige lo pendiente.

## 2. Requisitos funcionales

- **RF1.** Dentro de `/reports`, agregar una segunda pestaña "Registros y PDFs" que muestra una tabla con todos los envíos de un formulario seleccionado.
- **RF2.** Cada fila muestra fecha del envío, usuario que envió, y hasta 3-4 columnas resumen (paciente, documento — configurables por prompt del formulario).
- **RF3.** Al hacer clic en una fila, se abre un modal con la vista previa del PDF (iframe) y botones "Cerrar" / "Descargar PDF".
- **RF4.** Botón global "Enviar todos por correo" que dispara la descarga masiva.
- **RF5.** Filtros: rango de fechas (desde/hasta) + búsqueda por texto libre.
- **RF6.** El PDF individual se genera on-demand usando el `templateSnapshot` guardado en el momento del envío.
- **RF7.** La descarga masiva genera un ZIP con todos los PDFs (cada uno con el template de SU versión) y lo envía por link+2FA+documento igual que el reporte Excel.
- **RF8.** Envíos históricos sin `templateSnapshot` (anteriores a este cambio) se listan pero el botón "Ver PDF" queda deshabilitado con leyenda "No disponible".

## 3. Requisitos no funcionales

- **RNF1. Versionado transparente.** El usuario NO ve etiquetas V1/V2 en la UI. Cada PDF se regenera automáticamente con el template original de su envío.
- **RNF2. Eficiencia de almacenamiento.** El snapshot pesa ~10 KB por envío (solo el template HTML), no MB (evitar embedding de firmas/fotos como data-URLs).
- **RNF3. Sin duplicación de binarios.** Firmas y fotos siguen almacenadas en GridFS con referencia `gridfs:<id>`; al renderizar se resuelven al momento.
- **RNF4. Seguridad HABEAS DATA / HIPAA-like.** Los PDFs contienen PHI; toda descarga individual requiere JWT + `REPORTS_VIEW` + auditoría. La descarga masiva requiere además 2FA + documento + link único de 2 min TTL.
- **RNF5. Consistencia con el patrón existente.** Reutilizar `TotpService`, la UI de `ReportDownloadPage`, y el schema `ReportDownload` (renombrado o gemelo) — no crear un patrón paralelo.
- **RNF6. Rate limiting.** Descarga individual 30/min por usuario; masiva 1/min.
- **RNF7. Sin dependencia frágil.** `PdfRendererService` sigue con Puppeteer + Chrome local (aceptado); pero se documenta como requisito de deployment.

## 4. Arquitectura

### 4.1. Modelo de datos

En `backend/src/submissions/form-submission.schema.ts`:

```ts
@Prop({ type: String, default: null })
templateSnapshot: string | null;   // pdfTemplate HTML con placeholders ${...}
                                    // Peso típico: 2-20 KB. null si no había template.

@Prop({ type: String, default: null })
pdfFilename: string | null;         // Filename resuelto en el momento del envío
                                    // ej: "Consentimiento_JuanPerez_2026-07-22.pdf"

@Prop({ type: String, default: null })
templateVersion: string | null;     // SHA1 del templateSnapshot (analítica, no UI)
```

**Migración**: los `htmlSnapshot` que la usuaria ya introdujo (todavía sin datos productivos porque el frontend no llegó a poblar el campo) se eliminan del schema. No hay data-loss.

**Retrocompatibilidad**: submissions previos al cambio quedan con `templateSnapshot = null`. La UI los muestra con acción deshabilitada.

### 4.2. Endpoints backend

| Método | Ruta | Guards | Rate | Devuelve |
|---|---|---|---|---|
| GET | `/forms/:formId/records` | JWT + `REPORTS_VIEW` | — | Página de filas |
| GET | `/submissions/:id/pdf` | JWT + `REPORTS_VIEW` | 30/min | Blob PDF + auditoría |
| POST | `/forms/:formId/records/bulk-pdf` | JWT + `REPORTS_VIEW` | 1/min | `{ok, count}` + dispara link+2FA |
| GET | `/records/download/:token/meta` | JWT + ownership | 10/min | `{expiresAt, count, formName}` |
| POST | `/records/download/:token` | JWT + TOTP + ownership | 5/min | Blob ZIP cifrado |

Los dos últimos endpoints extienden el flujo genérico que ya existe para el reporte Excel. **Decisión de diseño**: renombramos `ReportDownload` → `SecureDownload` (schema y service) y le agregamos un discriminador `kind: 'excel' | 'bulk-pdf'`. Alternativa considerada (schema gemelo) rechazada por duplicación.

### 4.3. Servicio de render server-side

`SubmissionsService.generatePdf(id)`:

1. Cargar `submission` con `.select('templateSnapshot pdfFilename data formId submittedAt')`.
2. Si `templateSnapshot` es null → `NotFoundException("PDF no disponible para este registro")`.
3. Cargar form → mapa `widgetId → label` para expandir placeholders.
4. Interpolar `templateSnapshot` reemplazando `${label}` con valores de `data`:
   - Escape HTML de valores string
   - Referencias `gridfs:<id>` → resolver desde GridFS y embeber como `<img src="data:image/…">`
5. Pasar el HTML resultante a `PdfRendererService.htmlToPdfBuffer()`.
6. Devolver `{buffer, filename: pdfFilename ?? fallback}`.

`SubmissionsService.bulkPdf(formId, userId, filters)`:

1. Validar `usersService.findById(userId).documentNumber` existe (si no, 403).
2. Query submissions con `templateSnapshot != null` y filtros (fecha, texto) — límite 500.
3. Render en paralelo con concurrencia limitada (3 workers).
4. Empacar en ZIP con `archiver-zip-encrypted` + AES-256, pass = `documentNumber`.
5. `SecureDownloadsService.create({kind:'bulk-pdf', userId, blob:zip, ttlMs:120_000})`.
6. Auditoría `SUBMISSIONS_BULK_PDF_REQUESTED`.
7. `EmailService.sendReportLink(userEmail, downloadUrl, expiresAt)` — reutilizar el helper actual.

### 4.4. Frontend

**Pestañas** en `src/pages/ReportsPage.tsx`:
- Tab 1: "Excel por correo" — lo que hay hoy, sin cambios funcionales.
- Tab 2: "Registros y PDFs" — nueva.

**Nuevos componentes** en `src/components/reports/`:
- `RecordsTable.tsx` — tabla paginada con filtros
- `PdfPreviewModal.tsx` — modal con `<iframe src={blobUrl}>` y botones
- `BulkPdfButton.tsx` — botón "Enviar todos por correo" con confirmación

**Hooks** en `src/hooks/`:
- `useFormRecords.ts` — carga paginada, filtros, memoria de página
- `usePdfPreview.ts` — genera blob URL, cleanup en unmount

**Nueva ruta pública** `/records/download/:token` → `RecordsDownloadPage.tsx` (clon de `ReportDownloadPage.tsx` con label "PDFs" en vez de "Excel"). Alternativamente: generalizar `ReportDownloadPage` con prop `kind` — decisión de bajo nivel para el plan.

**Store**: NO se crea nuevo store Zustand. El listado de registros vive en un hook local `useFormRecords` con `useState`+`useEffect` (patrón consistente con `useHomeEntityForms` y demás hooks del proyecto — no hay react-query en `package.json`).

### 4.5. Seguridad — defense-in-depth

Reutiliza al 100% el patrón validado en la descarga segura de Excel:

1. **Rate limiting** con `@nestjs/throttler` en cada endpoint.
2. **Ownership check** — el token de descarga masiva solo puede ser consumido por el userId que lo generó (query en `SecureDownload` con `_id AND userId`).
3. **TOTP counter atómico** — `findOneAndUpdate({ _id, userId, consumed:false }, { $inc: { totpAttempts:1 } }, { new:true })`, si `attempts >= 5` se marca consumed (previene DoS cruzado — bug C1 de la sesión previa ya arreglado).
4. **HTML-escape** en todas las interpolaciones de correo — helper `escapeHtml()` reutilizado.
5. **Single-use** — token se marca `consumed:true` al primer POST exitoso.
6. **TTL 2 min** con índice `{expires:0}` de Mongo.

### 4.6. Auditoría

Se agregan 5 nuevas acciones al enum `AdminAction`:

- `SUBMISSION_PDF_VIEWED` — admin abrió el modal preview
- `SUBMISSION_PDF_DOWNLOADED` — descargó un PDF individual
- `SUBMISSIONS_BULK_PDF_REQUESTED` — pidió descarga masiva
- `SUBMISSIONS_BULK_PDF_DOWNLOADED` — descargó el ZIP masivo
- `SUBMISSIONS_BULK_PDF_FAILED` — falla (TOTP errado, TTL vencido)

Cada registro incluye `userId, formId, submissionId?, ip, userAgent, timestamp`.

## 5. Fases de implementación

### Fase 0 — Limpieza y fix de la sesión previa
- Borrar `src/pages/useSubmissionsStore.ts` (duplicado exacto de `src/store/`)
- Renombrar `htmlSnapshot` → `templateSnapshot` en schema, DTO, service, store, FormPage
- Quitar el método viejo `bulkPdfEmail` que enviaba ZIP como adjunto (contradice el patrón link+2FA)
- Quitar `archiver` como import directo del service (irá al nuevo `zip-crypto.ts`)

### Fase 1 — Backend: endpoints individuales
- `GET /forms/:formId/records` con paginación + filtros fecha + búsqueda
- `GET /submissions/:id/pdf` con render on-demand
- Nuevas acciones de auditoría (enum + persistencia)
- Tests: render con template+data+GridFS-image, filtros de query, auditoría

### Fase 2 — Frontend: pestañas + tabla + modal
- Pestañas en `ReportsPage.tsx`
- `RecordsTable.tsx` + `useFormRecords.ts`
- `PdfPreviewModal.tsx` + `usePdfPreview.ts`
- Botón "Descargar" reutiliza blob del preview (evita doble render)

### Fase 3 — Backend: descarga masiva
- Renombrar `ReportDownload` schema (Mongoose) → `SecureDownload` con campo `kind: 'excel' | 'bulk-pdf'`
- Script one-off que agrega `kind='excel'` a documentos existentes (o dejar que el default lo maneje si la colección está vacía; verificar antes de correr)
- `zip-crypto.ts` con AES-256 (`archiver-zip-encrypted`) + password = documentNumber
- `POST /forms/:id/records/bulk-pdf` end-to-end
- Controller de descarga (`GET/POST /records/download/:token`): reutiliza el `ReportDownloadsController` renombrado a `SecureDownloadsController`, sirve ambos flujos (Excel y bulk-pdf) diferenciando por `kind`

### Fase 4 — Frontend: descarga masiva
- Botón "Enviar todos por correo" con confirmación
- Página pública `/records/download/:token` (clon o generalización de `ReportDownloadPage`)
- Ruta pública en `AppRouter.tsx`
- `LoginRoute` extiende la safe-list de `returnTo` para incluir `/records/download/`

## 6. Ejecución

**Modo:** Subagent-Driven Development (SDD) igual que la descarga segura de Excel.

- Cada fase se divide en tareas atómicas (1 subagent implementador + 1 subagent revisor por tarea).
- Al terminar todas las fases, review adversarial completo con modelo opus.
- Bug loops hasta 0 críticos.

**Plan detallado**: se genera con el skill `writing-plans` después de aprobar este spec.

## 7. Criterios de aceptación

- [ ] La usuaria puede abrir `/reports` → tab "Registros y PDFs" → ver tabla de envíos de un formulario.
- [ ] Al clic en fila, el modal muestra el PDF renderizado con el formato original del envío.
- [ ] Al hacer clic en "Descargar PDF" en el modal, se guarda el PDF en el equipo.
- [ ] Al hacer clic en "Enviar todos por correo", el admin recibe un correo con link único.
- [ ] Al abrir el link, se pide TOTP; con TOTP correcto, se descarga un ZIP.
- [ ] El ZIP se abre con la contraseña = documento del admin.
- [ ] Si se cambia el template del formulario a V2, los envíos previos siguen generando PDFs con V1.
- [ ] Un envío histórico sin `templateSnapshot` aparece en la tabla como "No disponible" (no rompe).
- [ ] Todas las descargas quedan registradas en `admin_actions`.
- [ ] Rate limit de 30/min para PDF individual y 1/min para masivo funciona.
- [ ] Un ataque de counter-DoS cruzando `userId` no incrementa el contador de otro usuario.

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Puppeteer requiere Chrome local; si el server pierde Chrome, todos los PDFs fallan | Alto | Documentar como requisito de deploy + healthcheck opcional en `/healthz` |
| Un formulario con 5000 envíos genera timeout al pedir bulk-pdf | Medio | Límite duro de 500 por envío + mensaje UX explicando particionar por rango de fechas |
| Cambio de nombre `htmlSnapshot` → `templateSnapshot` puede romper datos previos | Bajo (no hay datos productivos aún) | Migración es un rename inofensivo si el campo está vacío |
| Rename `ReportDownload` → `SecureDownload` afecta la descarga de Excel actual | Medio | Migración cuidadosa: mismo schema + campo nuevo `kind` con default `'excel'` para retrocompatibilidad |
| Un HTML template malicioso (inyectado por admin) puede llegar a `page.setContent()` de Puppeteer | Bajo | El template lo cargan admins autenticados en el builder, no usuarios finales. Aún así, `Puppeteer` no ejecuta scripts sin habilitación explícita. |

## 9. Alternativas descartadas

- **Guardar HTML completo interpolado con firmas/fotos embebidas en base64**: peso 100× mayor, riesgo de exceder límite BSON de 16 MB. Descartado por RNF2/RNF3.
- **Versionar el pdfTemplate en el Form con historial completo**: más limpio arquitecturalmente pero complejo y con overhead injustificado — el template cambia raras veces. Descartado por sobrediseño.
- **Descarga masiva como ZIP adjunto al correo (lo que la usuaria había codificado)**: contradice el patrón link+2FA validado, expone PHI en el buzón. Descartado por RNF4/RNF5.
- **Mostrar badges V1/V2 al usuario en la tabla**: la usuaria lo rechazó explícitamente — el versionado debe ser transparente.
- **Preview client-side con jsPDF**: los PDFs del correo se generan con jsPDF+html2canvas (rasterizado). Reusarlo daría inconsistencia con el server-side de Puppeteer (vectorial). Descartado: server-side siempre.

## 10. Fuera de alcance

- Búsqueda full-text avanzada en los datos del envío (por ahora solo por texto plano sobre 3-4 campos)
- Exportar selección múltiple (solo "individual" o "todos"); si más adelante se pide, se agrega checkbox por fila
- Firma digital certificada / timestamp cualificado en los PDFs (feature futura, requiere infraestructura PKI)
- Preview offline / caché de PDFs generados (siempre on-demand)
