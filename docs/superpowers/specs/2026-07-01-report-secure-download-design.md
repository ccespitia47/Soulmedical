# Descarga segura de reportes — Diseño

**Fecha**: 2026-07-01
**Estado**: Aprobado, listo para plan de implementación
**Motivación**: los reportes de envíos contienen datos de salud/personales regulados (HABEAS DATA CO, LOPD, HIPAA-like). El flujo actual (adjunto ZIP con ZipCrypto en el correo) es insuficiente: cifrado débil, sin trazabilidad de descarga, sin expiración del archivo.

## Objetivo

Sustituir el correo con adjunto por un flujo **link único → autenticación robusta → descarga cifrada** que:

- Cifra el archivo con AES-256 real (OOXML nativo de Excel).
- Requiere autenticación multifactor (JWT + 2FA TOTP) para descargar.
- Vincula la descarga a un solo usuario y a un solo uso.
- Registra cada solicitud, descarga y fallo en la bitácora de auditoría.
- No deja archivos sensibles flotando en buzones de correo.

## Modelo de amenaza

Protegemos datos de salud/personales regulados. Un atacante razonable con la capacidad de interceptar UNO de los canales (correo, sesión, dispositivo TOTP, conocimiento del documento) NO debe poder abrir el reporte.

Actores esperados: empleado curioso, fuga accidental, cuenta de correo comprometida.
No cubrimos: adversarios estatales con acceso simultáneo a los 4 canales.

## Flujo end-to-end

```
Usuario clic "Solicitar reporte"
         │
         ▼
Backend: valida documento del usuario, genera XLSX en memoria,
         lo cifra con OOXML AES-256 (password = documentNumber),
         guarda blob en colección `report_downloads` con:
           - id (UUID v4)
           - userId
           - formId, formName (snapshot)
           - encryptedBuffer (Buffer del xlsx cifrado)
           - filename
           - expiresAt (now + 2 min)
           - consumed (false)
         Envía correo al usuario con link único:
           ${APP_BASE_URL}/reports/download/<token>
         │
         ▼
Usuario recibe correo → clic en el link
         │
         ▼
Ruta pública /reports/download/:token
   - Si NO hay sesión activa → redirect a /login?returnTo=<url>
   - Si SÍ hay sesión y user.id === reportDownload.userId → pantalla
     "Verificar 2FA para descargar tu reporte"
   - Ingresa código TOTP de su app authenticator
         │
         ▼
Backend: valida token del link + userId + código TOTP + no consumido +
         no expirado. Marca `consumed = true`, registra en admin_actions,
         entrega el buffer cifrado como respuesta HTTP con headers
         Content-Disposition: attachment; filename="Reporte_<form>_<fecha>.xlsx"
         │
         ▼
Navegador guarda el .xlsx cifrado en Descargas
         │
         ▼
Doble click en el .xlsx → Excel/LibreOffice pide password
         │
         ▼
Usuario escribe su número de documento → Excel abre el reporte
```

## Componentes backend

### Colección nueva `report_downloads` (Mongo)

```typescript
{
  _id: string,              // UUID v4 usado como token del link
  userId: number,           // id del User (Postgres) al que se envió
  formId: string,           // id del Form (Mongo)
  formName: string,         // snapshot para el nombre del archivo
  encryptedBuffer: Buffer,  // .xlsx ya cifrado con OOXML AES-256
  filename: string,         // "Reporte_<formSanitized>_<YYYY-MM-DD_HH-MM>.xlsx"
  expiresAt: Date,          // now + 2 min (TTL index)
  consumed: boolean,        // true tras primera descarga exitosa o exhausted
  consumedAt: Date | null,
  createdAt: Date,
  createdIp?: string,       // IP del solicitante para forense
}
```

**TTL index** en `expiresAt` (`{ expires: 0 }`) → MongoDB borra el documento y su `encryptedBuffer` automáticamente al pasar la fecha. Los datos sensibles no persisten indefinidamente.

### Nuevo servicio `ReportDownloadsService`

- `create(userId, formId, formName, encryptedBuffer, filename): Promise<{ token, expiresAt }>` — guarda blob, retorna token.
- `getMeta(token, userId): Promise<{ formName, expiresAt }>` — para la UI de verificación 2FA. Lanza `NotFoundException` (404) si no existe / expirado / consumido / user distinto. El mensaje es genérico: "Enlace no válido" (no revela cuál de las 4 causas).
- `consume(token, userId): Promise<{ buffer, filename }>` — valida y marca `consumed = true`. Atómico: usa `findOneAndUpdate({ _id, consumed: false, expiresAt: { $gt: now } }, { consumed: true, consumedAt: now })`. Si no encuentra doc → `GoneException` (410). Si encuentra pero `userId` distinto → `ForbiddenException` (403).

El `encryptedBuffer` se guarda como `Buffer` en Mongoose, se serializa a Mongo como tipo `BinData` (binary). No requiere GridFS: el `.xlsx` cifrado típico no supera 1-2 MB para volúmenes normales.

### Cambios en `ReportsService`

- Reemplazar `buildEncryptedZip()` por `buildEncryptedXlsx(xlsxBuffer, password)` usando la librería `secure-spreadsheet` (OOXML AES-256).
- Ya NO envía el archivo como adjunto. Después de generar el buffer cifrado:
  1. `reportDownloadsService.create(...)` → obtiene token.
  2. `emailService.sendReportLink(to, formName, url, expiresInMinutes)` → mail con link.
- El link armado: `${APP_BASE_URL}/reports/download/<token>`.

### Endpoints nuevos

| Método | Ruta | Guards | Propósito |
|---|---|---|---|
| `GET` | `/api/reports/download/:token/meta` | JwtAuthGuard | Devuelve `{ formName, expiresAt }` para armar la UI de verificación 2FA. Valida `userId` del JWT == token.userId. |
| `POST` | `/api/reports/download/:token` | JwtAuthGuard + throttler | Body: `{ code: string }`. Valida 2FA + consume el token + registra en auditoría + devuelve el buffer con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. |

Endpoint existente `POST /api/forms/:formId/submissions/export-email` sigue existiendo pero **cambia su comportamiento**: ya no envía adjunto, envía link.

### Dependencia nueva

- `secure-spreadsheet` (~200 KB, MIT) — envuelve un buffer XLSX y aplica OOXML AES-256 nativo. Es la librería madura en Node para esto. Alternativa (si tuviera issue en producción): reimplementar el estándar ECMA-376 a mano con `crypto` + `xml-js`, más trabajo.

### Auditoría — 3 acciones nuevas en `AdminActionType`

| Acción | Metadata | Cuándo |
|---|---|---|
| `REPORT_REQUESTED` | `{ formId, fieldCount, downloadToken }` | Al crear el blob (endpoint solicitar). |
| `REPORT_DOWNLOADED` | `{ formId, tokenId, elapsedMs, bytesServed }` | Al `consume()` exitoso. |
| `REPORT_DOWNLOAD_FAILED` | `{ formId, tokenId, reason: 'expired' \| 'wrong_user' \| 'invalid_totp' \| 'exhausted' \| 'not_found' }` | En cualquier fallo del flujo de descarga. |

Sincronizar el enum también en frontend (`AdminAuditAction` en `src/services/api.ts` y labels en `AdminAuditPage`).

## Componentes frontend

### Ruta nueva `/reports/download/:token`

Nuevo componente `ReportDownloadPage.tsx`. No usa `AdminSidebar` — vista minimalista tipo portal, similar a `ConsientifyLogin`. Enruta en `AppRouter.tsx` como ruta pública (el JwtAuthGuard vive en el backend; el frontend maneja el redirect a `/login` si no hay token).

### Máquina de estados

```
loading
  ├─► not_logged_in    → redirect a /login?returnTo=/reports/download/<token>
  ├─► wrong_user       → mensaje genérico "Enlace no válido"
  ├─► expired          → "Enlace expirado. Solicita un reporte nuevo."
  ├─► ready            → pantalla resumen + botón "Verificar 2FA →"
  │      │
  │      ▼
  ├─► verify_2fa       → input de código, timer descendente
  │      │
  │      ├─► code_error → mismo panel, mensaje "Código incorrecto" + contador de intentos
  │      │
  │      ▼
  ├─► downloading      → spinner "Descargando reporte…"
  │      │
  │      ▼
  ├─► done             → "✅ Reporte descargado" + tip de password
  │
  └─► error            → mensaje genérico "Enlace no válido"
```

### UI de cada estado

- `ready`: muestra formName, tiempo restante (setInterval 1s), botón principal.
- `verify_2fa`: reusa el patrón visual del `TwoFactorCodePanel` existente, pero con handler propio (`POST /reports/download/:token` con `{ code }`).
- `downloading`: al recibir el buffer, forzar descarga con `<a href={objectUrl} download={filename} />` invisible.
- `done`: mensaje explícito de que el password para abrir el `.xlsx` es su número de documento.
- Errores: mensajes genéricos, no revelan si el token existe o no.

### Contador visible

En `ready` y `verify_2fa`, mostrar `mm:ss` descendente en tiempo real (setInterval de 1 s). Al llegar a 0, la UI cambia a estado `expired` y desactiva el botón — **es solo cambio visual**, el backend re-valida siempre `expiresAt` al recibir cualquier request (defensa en profundidad: cliente no confiable).

### Ajuste al `ReportsPage` existente

Actualizar el mensaje de feedback tras solicitar:
> "Enviamos un enlace a tu correo. Tienes **2 minutos** para descargarlo. Necesitarás tu código 2FA y luego tu número de documento para abrir el Excel."

### Ajuste al correo (nueva plantilla `sendReportLink`)

Nueva plantilla HTML con:
- Título "Tu reporte está listo".
- Botón grande "Descargar reporte" (link con token).
- Advertencia del TTL de 2 minutos.
- Aviso de que el link es de un solo uso y requiere 2FA.
- Mensaje de que al abrir el Excel se pedirá el documento como contraseña.

## Defensa en profundidad

Cadena de validaciones — un atacante debe fallar en al menos UNA:

| Capa | Qué valida | Respuesta si falla |
|---|---|---|
| 1. Link válido | Token existe, no consumido, no expirado | 410 Gone |
| 2. Sesión activa | JWT presente y no expirado | Redirect a /login |
| 3. Mismo usuario | `req.user.id === reportDownload.userId` | 403 genérico |
| 4. 2FA activo | `user.totpEnabled === true` | 403 "Activa 2FA antes de descargar" |
| 5. Código TOTP | `totpService.verifyToken(code, secret)` | 401 + intento gastado |
| 6. OOXML AES-256 | password del archivo = documento del usuario | Excel no abre |

## Rate limiting

- `POST /forms/:formId/submissions/export-email` (solicitar): 5 requests / 10 min por usuario. Evita spam de generación de blobs.
- `POST /reports/download/:token` (verificar TOTP y descargar): 10 requests / min por IP + **máximo 3 intentos por token** de código TOTP incorrecto. Al 4º intento fallido: `consumed = true` con `reason: 'exhausted'`.
- `GET /reports/download/:token/meta`: 20 requests / min por IP.

## Cumplimiento

| Requisito | Cómo se cubre |
|---|---|
| Cifrado en tránsito | HTTPS con reverse proxy (pendiente de backlog, no bloquea este diseño) |
| Cifrado en reposo | AES-256 OOXML en archivo, TTL en blob temporal |
| Autenticación robusta | JWT + 2FA TOTP obligatorio para descargar |
| Trazabilidad de accesos | `admin_actions.REPORT_REQUESTED/DOWNLOADED/DOWNLOAD_FAILED` |
| Minimización de retención | TTL 2 min automático, un solo uso |
| Autorización por identidad | `userId === reportDownload.userId` estricto |
| Reporte de incidentes | Log de `REPORT_DOWNLOAD_FAILED` para revisión periódica |

## Migración y despliegue

- **Sin migraciones SQL**. Colección Mongo nueva se crea al primer insert.
- **Nuevos valores** en el enum `AdminActionType` (backend) y `AdminAuditAction` (frontend): `REPORT_REQUESTED`, `REPORT_DOWNLOADED`, `REPORT_DOWNLOAD_FAILED`.
- **Sin cambios** al modelo `User`.
- **Compatibilidad**:
  - Correos con ZIP ya enviados (bajo el flujo anterior) siguen siendo válidos: el archivo ZIP es autocontenido y se abre con el mismo documento del usuario como antes. Este diseño NO invalida nada retroactivamente.
  - Tras el despliegue, los reportes NUEVOS ya no llegan como ZIP: llegan como link. Es un cambio del contenido del correo, no de la API pública.
  - Sin cambios en URLs preexistentes ni firmas de endpoints usados por integraciones externas.
- **Variable de entorno** requerida: `APP_BASE_URL` (ya existe, se usa para reset de password) — es la URL del frontend.

## Testing

### Backend (unit + integration)

- `ReportDownloadsService.consume()` — cubrir todos los caminos: token inexistente, expirado, consumido, user distinto, éxito. Confirmar atomicidad (dos consumes concurrentes → solo uno gana).
- `ReportsService` con `secure-spreadsheet` — generar buffer + verificar que abre con password correcto en Excel real (test manual o `officecrypto-tool` para validar en Node).
- Endpoints con curl/postman: casos de 401, 403, 410, 200.

### Frontend (manual)

- Solicitar reporte → recibir correo → clic → login si hace falta → 2FA → descargar → abrir en Excel con documento.
- Reintento con link ya consumido → mensaje de expirado.
- Reintento con TOTP incorrecto 3 veces → link se agota.
- Esperar 2 min sin actuar → mensaje de expirado.

### Seguridad (manual)

- Interceptar la URL del correo, abrir desde otro usuario → 403.
- Abrir link expirado → 410.
- Ver que después de 2 min el documento en Mongo desaparece.

## Fuera de alcance

- Rotación de secrets del email de Microsoft Graph (pendiente separado en el backlog).
- HTTPS reverse proxy (pendiente separado en el backlog). El diseño ASUME que el traffic entre navegador y backend será HTTPS en producción.
- Soporte para Numbers (Apple) o Google Sheets abriendo el archivo — solo garantizamos Microsoft Excel y LibreOffice Calc, que soportan OOXML AES-256.
- Exportar en otros formatos (CSV, PDF). Solo XLSX.
