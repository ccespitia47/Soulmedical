# SoulForms – Documentación de la API para integraciones externas

Esta documentación describe el subconjunto de la API que un cliente externo
(MCP de Claude, Power BI, scripts, otros servicios) puede consumir usando una
**API Key** emitida desde el panel admin.

Los endpoints que escriben (`POST`, `PATCH`, `DELETE`) sobre operaciones
destructivas (editar un formulario, borrar, cambiar permisos, publicar) **no**
se exponen a la API key y requieren JWT con sesión interactiva. Lo listado
aquí es todo lo que una integración externa puede hacer.

---

## 1. Autenticación

### Esquema

Toda petición debe llevar el header:

```
x-api-key: sk_<64-hex-chars>
```

- Las API keys se crean en `/admin?section=api_keys` (solo admins).
- Al crearla, SoulForms muestra el valor completo **una sola vez**. Si se
  pierde, no se recupera: hay que generar otra.
- Se pueden revocar en el mismo panel. Una vez revocadas, cualquier petición
  posterior devuelve `401`.

### Resolución del usuario

Internamente la key está ligada al usuario que la creó (`createdById`). Al
validarla, el backend popula el contexto de la petición con el perfil de ese
usuario, así los permisos y los campos "quién creó" quedan atribuidos a él.
En particular `POST /forms` guarda `createdById = <owner de la key>`.

### Códigos de error de auth

| HTTP | Significado |
|------|-------------|
| `401 Unauthorized` | Key ausente, revocada, inexistente, o backend no reconoce el header. |
| `403 Forbidden` | Key válida, pero el usuario owner no tiene el permiso requerido (p. ej. `FORMS_CREATE` para `POST /forms`). |

---

## 2. Base URL y convenciones

- **Producción**: `https://soulforms.com.co/api`
- **Content-Type** siempre: `application/json`
- Timestamps en ISO 8601 (`2026-10-16T12:34:56.789Z`)
- IDs: UUID v4 en todos los recursos (`_id` y `id` son el mismo valor; `id`
  es un alias que el `toJSON` del schema añade — usá `id` en el cliente).

---

## 3. Endpoints

### 3.1 Projects

Proyectos son el contenedor raíz. Un proyecto contiene carpetas, y una
carpeta contiene formularios.

#### `GET /projects`

Lista los proyectos accesibles para el owner de la API key.

**Respuesta `200 OK`**:
```json
[
  {
    "id": "1bbe99dd-2c44-4680-a1fd-46e89a051964",
    "_id": "1bbe99dd-2c44-4680-a1fd-46e89a051964",
    "name": "Inteligencia Digital",
    "color": "#3b82f6",
    "icon": "building",
    "isActive": true,
    "ownerId": 19,
    "createdAt": "2026-10-01T13:12:38.019Z",
    "updatedAt": "2026-10-01T13:12:38.019Z"
  }
]
```

#### `GET /projects/:id`

Devuelve un proyecto por id.

**Respuesta `200 OK`**: igual que un elemento de la lista.

**`404 Not Found`** si no existe.

---

### 3.2 Folders

Carpetas lógicas dentro de un proyecto. Agrupan formularios por tema.

#### `GET /folders?projectId=<uuid>`

Lista las carpetas de un proyecto.

**Query**:
- `projectId` *(requerido)*: UUID del proyecto.

**Respuesta `200 OK`**:
```json
[
  {
    "id": "52c5d8a1-4665-41f0-865e-1d1a2e4f4a8e",
    "_id": "52c5d8a1-4665-41f0-865e-1d1a2e4f4a8e",
    "name": "Consentimientos",
    "color": "#00c2a8",
    "icon": "📁",
    "isActive": true,
    "projectId": "1bbe99dd-2c44-4680-a1fd-46e89a051964",
    "createdAt": "2026-09-28T10:00:00.000Z",
    "updatedAt": "2026-10-01T13:12:38.019Z"
  }
]
```

#### `GET /folders/:id`

Devuelve una carpeta por id.

#### `POST /folders`

Crea una carpeta dentro de un proyecto.

**Body**:
```json
{
  "name": "Nueva carpeta",     // string, requerido
  "projectId": "<uuid>",       // UUID, requerido
  "color": "#00c2a8",          // string ≤20 chars, opcional
  "icon": "📁"                  // string ≤10 chars, opcional
}
```

**Respuesta `201 Created`**: la carpeta creada con su `id`.

---

### 3.3 Forms

Formularios dinámicos. Contienen un `schema` con la lista de widgets y
reglas condicionales opcionales.

#### `GET /forms?folderId=<uuid>`

Lista los formularios de una carpeta.

**Query**:
- `folderId` *(requerido)*: UUID de la carpeta.

**Respuesta `200 OK`**: array de objetos `Form` (ver sección 4).

#### `GET /forms/:id`

Devuelve un formulario por id.

**Respuesta `200 OK`**: un objeto `Form` con el `schema` completo.

**`404 Not Found`** si no existe.

#### `POST /forms`

Crea un formulario nuevo. El owner de la API key debe tener permiso
`FORMS_CREATE`.

**Body**:
```json
{
  "name": "Consentimiento de vacunación",   // string, requerido
  "folderId": "<uuid>",                     // UUID, requerido
  "schema": {                               // objeto, opcional (default {widgets:[]})
    "widgets": [ /* ver sección 5 */ ],
    "rules": []                             // reglas opcionales; para integraciones externas dejar vacío
  },
  "emailTemplate": null                     // opcional, para integraciones externas dejar null
}
```

**Respuesta `201 Created`**: el formulario creado, incluyendo el `id`
autogenerado y `createdById = <owner de la key>`.

**`403 Forbidden`**: la key existe pero su user owner no tiene
`FORMS_CREATE`.

---

## 4. Shape de recursos

### `Project`
```ts
{
  id: string;              // UUID (alias de _id)
  _id: string;             // UUID
  name: string;
  color: string;           // hex, ej "#3b82f6"
  icon: string;            // emoji o nombre de icono
  isActive: boolean;
  ownerId: number;         // id numérico del user owner
  createdAt: string;       // ISO 8601
  updatedAt: string;
}
```

### `Folder`
```ts
{
  id: string;
  _id: string;
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
  projectId: string;       // UUID del proyecto padre
  createdAt: string;
  updatedAt: string;
}
```

### `Form`
```ts
{
  id: string;
  _id: string;
  name: string;
  folderId: string;        // UUID de la carpeta padre
  schema: {
    widgets: WidgetInstance[];
    rules?: unknown[];     // opcional, no documentado aquí
  };
  emailTemplate: object | null;   // config de email + PDF
  version: number;         // comienza en 1, se incrementa al editar
  isActive: boolean;
  createdById: number;     // id numérico del user que lo creó
  isPublic: boolean;       // si acepta submissions sin login
  sendConfirmationEmail: boolean;
  requiresEmailVerification: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### `WidgetInstance`
```ts
{
  id: string;              // UUID interno del widget dentro del form
  type: string;            // uno de los 26 tipos (ver sección 5)
  label: string;           // etiqueta visible junto al campo
  required: boolean;       // si es campo obligatorio
  config: Record<string, unknown>;  // configuración específica del tipo
}
```

---

## 5. Catálogo de widgets

Los 26 tipos disponibles con su `defaultConfig`. Al crear un widget se puede
omitir `config` (se aplicará el default) o pasar un objeto parcial que se
mergea sobre el default.

| `type` | Label visible | Descripción |
|--------|---------------|-------------|
| `text` | Texto | Input de una línea con restricciones de longitud y clase de caracteres. |
| `textarea` | Párrafo | Multi-línea con control de longitud y filas. |
| `number` | Número | Numérico con cotas min/max/step y decimales opcionales. |
| `email` | Email | Input de email con validación. |
| `phone` | Teléfono | Con selector de país (LATAM+ES+US). |
| `date` | Fecha | Selector de fecha con cotas opcionales. |
| `time` | Hora | HH:MM, opcional pre-llenado con hora actual. |
| `select` | Desplegable | Dropdown single/multi, opcional expandido. |
| `radio` | Radio | Radio buttons, opciones pueden tener imagen. |
| `checkbox` | Casillas | Grupo de checkboxes. |
| `signature` | Firma | Pad de firma manuscrita. |
| `photo` | Foto | Captura/subida con tope de tamaño. |
| `file` | Archivo | Subida genérica con límite. |
| `video` | Video | Captura/subida con duración y tamaño. |
| `image` | Imagen | Imagen estática en el form. |
| `header` | Encabezado | Encabezado de sección. |
| `html_block` | Bloque HTML | HTML enriquecido (branding, legales). |
| `subform` | Subformulario | Grupo repetible anidado. |
| `search` | Búsqueda | Typeahead contra submissions/Sheets/Excel/SQL. |
| `calc` | Cálculo | Campo read-only sum/avg/etc sobre otros widgets. |
| `price` | Precio | Entrada monetaria con formato. |
| `barcode` | Código barras | Scanner de códigos de barras. |
| `id_scanner` | Cédula (OCR) | Escanea cédulas CO (PDF417/MRZ). |
| `id_document` | Documento ID | Entrada de documento por país. |
| `quiz_question` | Pregunta evaluada | Con opciones puntuadas. |
| `quiz_score` | Nota final | Agrega puntos de quiz_question. |

### `defaultConfig` por tipo

Los defaults completos están en el MCP (`tools/soulforms-mcp/src/widget-catalog.ts`)
y también se obtienen vía la tool `list_widget_types`. Resumen de los más usados:

```jsonc
// text
{ "placeholder":"", "defaultValue":"", "maxLength":100,
  "allowNumbers":false, "allowSpecialChars":false, "allowLineBreaks":false }

// textarea
{ "placeholder":"", "maxLength":500, "rows":4 }

// number
{ "placeholder":"", "min":0, "max":999999, "step":1, "allowDecimals":false }

// email
{ "placeholder":"correo@ejemplo.com" }

// phone
{ "placeholder":"300 123 4567", "prefix":"+57", "maxLength":10,
  "enableCountrySelector":false, "defaultCountry":"CO" }

// date
{ "min":"", "max":"" }

// time
{ "nowByDefault":false, "rememberInput":false }

// select
{ "placeholder":"Selecciona una opción",
  "options":["Opción 1","Opción 2","Opción 3"],
  "defaultValue":"", "sortAlphabetically":false,
  "multiple":false, "expand":false, "rememberEntry":false }

// radio
{ "options":[{"id":"opt_1","label":"Opción 1"},{"id":"opt_2","label":"Opción 2"}],
  "useImageLabels":false, "defaultValue":"",
  "verticalAlign":true, "rememberInput":false }

// checkbox
{ "options":["Opción 1","Opción 2","Opción 3"] }

// signature
{ "penColor":"#000000", "penWidth":2 }

// photo
{ "allowCamera":true, "allowUpload":true, "maxSizeMB":5 }

// file
{ "fileType":"documents", "maxSizeMB":25 }

// header
{ "text":"Sección", "size":"medium", "showDivider":true }

// subform
{ "addButtonLabel":"Agregar", "fields":[], "minEntries":0, "maxEntries":0 }
```

---

## 6. Ejemplos end-to-end

### 6.1 Listar proyectos

```bash
curl -H "x-api-key: sk_abc123..." \
     https://soulforms.com.co/api/projects
```

### 6.2 Crear carpeta

```bash
curl -X POST -H "x-api-key: sk_abc123..." \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Formularios clínicos",
       "projectId": "1bbe99dd-2c44-4680-a1fd-46e89a051964"
     }' \
     https://soulforms.com.co/api/folders
```

### 6.3 Crear formulario con 3 widgets

```bash
curl -X POST -H "x-api-key: sk_abc123..." \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Consentimiento de vacunación",
       "folderId": "52c5d8a1-4665-41f0-865e-1d1a2e4f4a8e",
       "schema": {
         "widgets": [
           {
             "id": "w_fecha",
             "type": "date",
             "label": "Fecha",
             "required": true,
             "config": { "min": "", "max": "" }
           },
           {
             "id": "w_nombre",
             "type": "text",
             "label": "Nombre del paciente",
             "required": true,
             "config": { "placeholder": "", "defaultValue": "",
                         "maxLength": 100, "allowNumbers": false,
                         "allowSpecialChars": false, "allowLineBreaks": false }
           },
           {
             "id": "w_firma",
             "type": "signature",
             "label": "Firma del paciente",
             "required": true,
             "config": { "penColor": "#000000", "penWidth": 2 }
           }
         ],
         "rules": []
       }
     }' \
     https://soulforms.com.co/api/forms
```

### 6.4 Verificar formulario creado

```bash
curl -H "x-api-key: sk_abc123..." \
     https://soulforms.com.co/api/forms/<id-devuelto>
```

---

## 7. Lo que NO se puede hacer con API key

Por diseño, estas operaciones requieren JWT (sesión interactiva de admin):

- `PATCH /forms/:id` — editar un formulario
- `DELETE /forms/:id` — eliminar
- `PATCH /forms/:id/toggle-public` — publicar/despublicar
- `POST /forms/:id/assign` — asignar a usuarios
- `PATCH /folders/:id` / `DELETE /folders/:id`
- `PATCH /projects/:id` / `DELETE /projects/:id`
- Cualquier endpoint de `/users`, `/groups`, `/consents`, `/tasks`,
  `/submissions`, `/reports`, `/api-keys` (gestión).

Si una integración necesita algo de esto, hay que hacerlo manualmente desde
el panel admin o pedir que se amplíe el guard del endpoint.

---

## 8. Convenciones para generar un formulario correcto

Reglas a seguir cuando se construye un `widgets[]` desde fuera (ej. clonando
desde otra plataforma):

1. **`id`**: debe ser único dentro del formulario; usar UUID o un slug
   descriptivo (`w_<campo>`). Si se omite al crear, el backend lo asigna.
2. **`type`**: debe ser uno de los 26 strings exactos del catálogo. Un valor
   desconocido rompe el renderer.
3. **`label`**: obligatorio y visible al usuario final.
4. **`required`**: boolean. Default `false`.
5. **`config`**: puede omitirse completo o pasar solo las claves que uno
   quiere sobrescribir. El resto se completa con `defaultConfig`.
6. **Orden**: los widgets se renderizan en el orden del array. No existe un
   `position` separado.
7. **Opciones de `select`**: array de strings.
8. **Opciones de `radio`**: array de objetos `{id, label, imageUrl?}`. Si se
   pasa un array de strings, el backend lo normaliza al momento de servir.
9. **Opciones de `checkbox`**: array de strings.
10. **No incluir `rules`** desde una integración externa — las reglas tienen
    IDs internos que deben coincidir con los `widget.id`, es frágil
    manejarlo desde fuera. Dejar `rules: []`.
11. **No incluir `emailTemplate`** — queda en `null` y el admin lo configura
    desde la UI si quiere envío automático de PDF por email.

---

## 9. Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|----------------|-----|
| `401 Unauthorized` global | Key revocada o no enviada | Verificar que `x-api-key` esté en el header y la key esté activa en el panel admin. |
| `403 Forbidden` en `POST /forms` | Owner sin `FORMS_CREATE` | Un admin tiene que agregarle el permiso al user owner de la key. |
| `400 Bad Request` en `POST` | DTO inválido (campos faltantes o tipos incorrectos) | Revisar que `name` esté presente, `folderId`/`projectId` sean UUID válidos. |
| `404 Not Found` en `GET /:id` | El recurso fue borrado (soft/hard) o el id es incorrecto | Verificar que el id exista con el `GET` de lista. |
| `500 Internal Server Error` | Error inesperado del backend | Pegar el error completo y el curl que lo reprodujo al equipo. |

---

## 10. Resumen de endpoints para integraciones

| Método | Path | Notas |
|--------|------|-------|
| `GET` | `/projects` | Lista. |
| `GET` | `/projects/:id` | Detalle. |
| `GET` | `/folders?projectId=<uuid>` | Lista por proyecto. |
| `GET` | `/folders/:id` | Detalle. |
| `POST` | `/folders` | Crear carpeta. |
| `GET` | `/forms?folderId=<uuid>` | Lista por carpeta. |
| `GET` | `/forms/:id` | Detalle. |
| `POST` | `/forms` | Crear formulario. Requiere `FORMS_CREATE` en el owner. |

Fin de la documentación.
