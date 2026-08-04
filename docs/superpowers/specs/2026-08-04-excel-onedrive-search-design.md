# Diseño · Widget search sobre Excel de OneDrive/SharePoint (Graph API)

**Fecha:** 2026-08-04
**Autora:** moreapp.sara@gmail.com (con Claude Code / superpowers)
**Estado:** Draft — pendiente aprobación

---

## 1. Contexto y motivación

El widget `search` (agregado en sesiones previas) soporta la fuente `excel_web`, pero hoy hace `fetch` directo desde el navegador a la URL de OneDrive/SharePoint que la usuaria pega. Ese fetch **falla por CORS** en ~100% de los casos porque OneDrive/SharePoint no envían `Access-Control-Allow-Origin` en su respuesta. Resultado: al pegar la URL, "no hace nada".

Además, aún si el navegador pudiera leer la URL de compartir, esa URL devuelve un HTML de preview, no el binario `.xlsx`. Se requiere un paso de conversión adicional.

Este spec resuelve ambos problemas moviendo la lectura al backend (donde no hay CORS) y usando **Microsoft Graph API** con credenciales de aplicación (`client_credentials`) para acceder a Excel privados del tenant corporativo.

## 2. Alcance y no-alcance

**En alcance:**
- Widget `search` con `sourceType: 'excel_web'` funcional para Excel almacenados en SharePoint corporativo del mismo tenant Azure que ya usa el backend para email.
- Auto-detección de headers al pegar la URL en el builder (misma UX que el source Google Sheets).
- Dropdown de "Columna donde buscar", "Columnas a mostrar" y "Rellenar campos al seleccionar" poblado con los headers reales.
- Cambios en el Excel visibles en la app en máx. 60s (cache in-memory).
- Excel privados del tenant (no requiere que sean públicos en Internet).

**Fuera de alcance:**
- OneDrive personal (`onedrive.live.com`, cuentas @outlook/@hotmail).
- Excel de tenants Azure distintos al de SoulForms.
- Escritura al Excel (solo lectura).
- OAuth por usuario (usamos app-only credentials).
- Persistencia del Excel en base de datos o disco (memoria únicamente).
- Notificaciones "el Excel cambió" (siempre pull, nunca push).

## 3. Requisitos funcionales

- **RF1.** El backend expone `POST /excel/headers` que recibe `{url}` y devuelve `{headers: string[]}` con la primera fila del Excel.
- **RF2.** El backend expone `POST /excel/search` que recibe `{url, q, searchCol}` y devuelve `{rows: Record<string,unknown>[]}` (máx. 20 filas que contengan `q` en la columna `searchCol`).
- **RF3.** El frontend, al pegar la URL en el builder, invoca `POST /excel/headers` con debounce 600ms y muestra los headers como dropdown (feedback: detectando / N columnas / error).
- **RF4.** El source `excel_web` del widget search llama al backend en vez de fetch directo.
- **RF5.** Los dropdowns "Columna donde buscar", "Columnas a mostrar en resultados" y "Rellenar campos al seleccionar" usan los headers auto-detectados como opciones.

## 4. Requisitos no funcionales

- **RNF1. Seguridad — permisos guard.** Ambos endpoints requieren JWT + `Permission.FORMS_EDIT` (solo admins que arman formularios pueden usar el proxy; usuarios finales que llenan forms nunca lo invocan directo).
- **RNF2. Rate limiting.** `POST /excel/headers` 20/min por usuario; `POST /excel/search` 60/min por usuario.
- **RNF3. Cache in-memory 60s.** Cada URL cachea su binario `xlsx` en `Map<url, {buffer, expiresAt}>` con TTL 60s. Sin disco, sin Mongo. Cambios en el Excel se ven en <=60s.
- **RNF4. Bounded memory.** El cache tiene límite de 100 entries (LRU simple) para evitar leaks con muchos widgets distintos.
- **RNF5. Sin persistencia del archivo.** El buffer del Excel vive solo en memoria del proceso. Reinicio del backend → cache vacío → primer fetch recarga.
- **RNF6. Reutilizar auth existente.** No creamos nuevo cliente OAuth — usamos `GraphTokenService` (ya funcional para email) con el mismo `TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET`.
- **RNF7. Retry con backoff ante 429/503.** Reutilizar el mismo helper que agregamos a `EmailService.sendViaGraph` (Retry-After + exponencial 2/4/8s, máx. 3 intentos).
- **RNF8. Manejo claro de errores.** Mensajes UI accionables (URL no reconocida, permiso faltante, archivo no existe, no es xlsx válido).

## 5. Arquitectura

### 5.1 Módulo backend nuevo

```
backend/src/excel/
├── excel.module.ts
├── excel.controller.ts       # POST /excel/headers, POST /excel/search
├── excel.service.ts          # resolveShareId + Graph + parse xlsx
├── excel-cache.service.ts    # Map<url, CacheEntry> con TTL
└── excel.service.spec.ts     # tests unitarios (resolveShareId + cache)
```

**Dependencias del módulo:** `EmailModule` (para consumir `GraphTokenService`), `AuthModule` (para guards). `xlsx` npm package (ya instalado, lo usa el frontend actual).

### 5.2 Flujo end-to-end

```
[Admin en builder]                      [Backend NestJS]                     [Graph API]
      │                                        │                                 │
      │  1. Pega URL SharePoint                │                                 │
      │  2. Auto-detect debounce 600ms         │                                 │
      │────POST /excel/headers { url }────────>│                                 │
      │                                        │  3. resolveShareId(url) local   │
      │                                        │  4. Cache hit? → skip a 7       │
      │                                        │  5. GraphTokenService.getToken()│
      │                                        │────────────Graph─OAuth─────────>│
      │                                        │<────────access_token────────────│
      │                                        │  6. GET /shares/{id}/           │
      │                                        │     driveItem/content           │
      │                                        │────────────────────────────────>│
      │                                        │<────binario xlsx (~10-500 KB)───│
      │                                        │  7. cache.set(url, buffer, 60s) │
      │                                        │  8. parse xlsx → primera fila   │
      │  9. { headers: [...] }                 │                                 │
      │<───────────────────────────────────────│                                 │
      │                                        │                                 │
      │  UI muestra dropdown con columnas      │                                 │
      │                                        │                                 │
      │  ── user final busca "14" en el form ──                                  │
      │                                        │                                 │
      │────POST /excel/search { url, q, col }─>│                                 │
      │                                        │  10. Cache hit (dentro 60s)     │
      │                                        │  11. parse xlsx → filtrar por q │
      │  12. { rows: [...] }                   │                                 │
      │<───────────────────────────────────────│                                 │
```

### 5.3 Componentes clave

**`ExcelService.resolveShareId(url: string): string`**
- Convierte una URL de SharePoint a share-id encodeado (formato `u!<base64url>`) para la Graph API.
- Referencia: [Encoding sharing URLs](https://learn.microsoft.com/en-us/graph/api/shares-get#encoding-sharing-urls).
- Algoritmo: base64(url) → reemplazar `/` con `_`, `+` con `-`, remover `=` finales → prefijo `u!`.

**`ExcelService.downloadBinary(shareId, token): Promise<Buffer>`**
- `GET https://graph.microsoft.com/v1.0/shares/{shareId}/driveItem/content`
- `Authorization: Bearer {token}` + retry helper.
- Devuelve el `arrayBuffer` como `Buffer`.

**`ExcelCacheService`**
```ts
type CacheEntry = { buffer: Buffer; expiresAt: number };
class ExcelCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 60_000;
  private readonly MAX_ENTRIES = 100;

  async getOrFetch(url: string, fetchFn: () => Promise<Buffer>): Promise<Buffer> {
    const hit = this.cache.get(url);
    if (hit && Date.now() < hit.expiresAt) return hit.buffer;
    const buffer = await fetchFn();
    if (this.cache.size >= this.MAX_ENTRIES) this.evictOldest();
    this.cache.set(url, { buffer, expiresAt: Date.now() + this.TTL_MS });
    return buffer;
  }
}
```

**`ExcelService.extractHeaders(buffer): string[]`**
- `read(buffer, {type:'array'})` → primer sheet → `sheet_to_json` con `{header: 1}` → primera fila.
- Trim + filter Boolean.

**`ExcelService.searchRows(buffer, q, searchCol): Row[]`**
- Parse igual → `sheet_to_json` normal (con headers).
- Filter case-insensitive por `row[searchCol]` contains `q`.
- Slice a 20 max.

### 5.4 Frontend

**Cambios en 2 archivos:**

1. `src/components/widgets/search/sources/excelWeb.ts`:
   - Ya no hace `import("xlsx")` ni fetch directo.
   - Llama `POST /excel/search` vía `request()` helper.
   - Nueva export `fetchExcelHeaders(url): Promise<string[]>` que llama `POST /excel/headers`.

2. `src/components/widgets/search/Search.properties.tsx`:
   - Nuevo estado `excelHeaders`, `excelDetecting`, `excelError` (paralelo al que ya existe para `sheetsHeaders`).
   - `useEffect` con debounce 600ms que dispara `fetchExcelHeaders` cuando cambia `config.excelUrl` y el source es `excel_web`.
   - Bloque UI actual de `excel_web` reemplazado por versión con auto-detect (feedback visual + dropdown).
   - Extender `sourceFieldOptions` para `excel_web` con `excelHeaders` (mismo patrón que Google Sheets).

## 6. Manejo de errores

| Escenario | HTTP status | Mensaje UI |
|---|---|---|
| URL no reconocida como SharePoint | 400 | "URL de SharePoint no reconocida" |
| Graph 403 (permiso faltante o mal configurado) | 502 | "El backend no tiene permiso Files.Read.All. Contacta al admin de Azure." |
| Graph 404 (archivo movido/borrado) | 404 | "El archivo no existe o fue movido." |
| Graph 429 (throttle) | (interno, retry) | (nada al UI si el retry funciona) |
| Graph timeout / network error | 502 | "No se pudo conectar con OneDrive. Reintenta." |
| Parse xlsx falla (no es un xlsx válido) | 500 | "El archivo no es un Excel válido." |
| Buffer > 20 MB | 413 | "El Excel es demasiado grande (máx. 20 MB)." |

## 7. Setup Azure (una sola vez, manual)

1. Portal Azure → **App registrations** → SoulForms.
2. **API permissions** → **Add a permission** → Microsoft Graph → **Application permissions** → buscar `Files.Read.All` → agregar.
3. Clic **"Grant admin consent for [tenant]"** (requiere admin del tenant).
4. Verificar que la columna "Status" dice **"Granted for [tenant]"** (checkmark verde).

**Sin cambios en `.env`.** El backend ya tiene `TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET` para el email.

## 8. Seguridad

- **Auth**: JWT + `Permission.FORMS_EDIT` en ambos endpoints. Usuarios finales que llenan forms nunca invocan directo el proxy.
- **Rate limit**: 20/min headers, 60/min search por usuario, previene abuso.
- **Alcance del permiso Files.Read.All**: lectura de archivos del **tenant propio** únicamente. No accede a OneDrive personal externo ni a otros tenants.
- **Auditoría (opcional, no bloqueante para MVP)**: agregar `EXCEL_URL_ACCESSED` a `admin_actions` con `{userId, url, timestamp}` — permite trazabilidad de qué admin consultó qué Excel. Fuera del alcance de este spec por YAGNI; puede agregarse después.
- **XSS**: los valores del Excel se muestran en el modal con React JSX (escape automático). No hay `dangerouslySetInnerHTML`.
- **Cache aislamiento**: el cache es por URL absoluta. Si dos widgets distintos usan la misma URL, comparten el buffer (bueno). Si son distintas URLs, entries independientes.

## 9. Criterios de aceptación

- [ ] Admin del tenant Azure aprobó `Files.Read.All` (verificable con checkmark verde en Azure Portal).
- [ ] En el builder, al pegar URL de SharePoint del tenant en un widget search con source `excel_web`, aparece "Detectando…" y luego "✓ N columnas detectadas".
- [ ] El dropdown "Columna donde buscar" muestra los headers reales del Excel.
- [ ] Los dropdowns "Columnas a mostrar" y "Rellenar campos al seleccionar" también los muestran.
- [ ] Al buscar en un formulario del builder, aparecen resultados reales del Excel.
- [ ] Un cambio en el Excel se ve reflejado en la app en <=60s.
- [ ] Un usuario final (sin `FORMS_EDIT`) recibe 403 si llama directo al endpoint `/excel/search`.
- [ ] Con URL de OneDrive personal (`onedrive.live.com`) o de otro tenant, sale el error 400 esperado.
- [ ] Reinicio del backend limpia el cache; el primer fetch después del reinicio funciona correctamente.
- [ ] Rate limit se dispara correctamente si se exceden los límites.

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Admin del tenant no está disponible o no aprueba el permiso | Alto — feature no funciona | Comunicar antes con el admin; el consent son 30 segundos de trabajo |
| Excel muy grande (>20 MB) llena la memoria | Medio | Límite duro 20 MB, error 413 claro |
| Muchos widgets con Excel distintos saturan cache | Bajo | LRU limita a 100 entries |
| SharePoint URL cambia de formato (Microsoft rediseña la URL) | Bajo | Regex conservador + tests unitarios; feedback claro de "URL no reconocida" |
| El endpoint del backend es abusado para leer cualquier Excel del tenant | Medio | Guard por `FORMS_EDIT` + rate limit + auditoría opcional |

## 11. Alternativas descartadas

- **Fetch directo desde navegador**: bloqueado por CORS. Es lo que hay hoy y lo que estamos arreglando.
- **URL pública con `?download=1` sin Graph**: descartado explícitamente por la usuaria — requeriría Excel públicos en Internet.
- **OAuth por usuario (delegated)**: descartado por complejidad. Cada admin tendría que "Iniciar sesión con Microsoft" en el builder.
- **Persistir el Excel en GridFS**: descartado explícitamente por la usuaria — quiere que cambios se reflejen automáticamente sin re-subir.
- **Cache más largo (5 min o infinito)**: descartado por la usuaria — 60s es el balance elegido.

## 12. Trabajo estimado

- Backend (module + controller + service + cache + tests): **~2 h**
- Frontend (source + Search.properties): **~30 min**
- Azure setup (por parte del admin): **~10 min**
- Testing E2E manual: **~30 min**
- **Total: ~3-4 h + tiempo del admin de Azure**

## 13. Ejecución

Modo: Subagent-Driven Development (SDD), consistente con el resto de features grandes del proyecto. El plan detallado se genera con el skill `writing-plans` después de aprobar este spec.
