# Ajustes de Widgets (Texto, Párrafo, Teléfono, Cédula) — Diseño

**Fecha:** 2026-09-03
**Alcance:** 4 widgets del builder de formularios. Cambios acotados y sin tocar nada fuera de estos archivos.

## Contexto

Sara reporta 4 ajustes puntuales de UX/comportamiento en widgets existentes del builder de formularios:

1. **Texto** — quiere poder permitir salto de línea.
2. **Párrafo** — el salto de línea "no funciona"; investigación confirma que técnicamente sí se escribe (el `<textarea>` es nativo, sin interceptores), pero el `\n` se **colapsa aguas abajo** al renderizar (PDF, tabla de submissions, Excel).
3. **Teléfono** — hoy el prefijo lo fija el admin y es inmutable para el usuario final. Quiere una opción para que el usuario pueda cambiar el país con un modal buscable, con validación cruzada bloqueante entre número y país.
4. **Cédula** (`id_scanner`) — el OCR con Tesseract "no capta bien los datos, a veces a medias". Todos los campos fallan por igual. Deben soportar CC/CE/TI/Pasaporte.

**Constraint explícito de Sara:** "solo revisa estos cambios que te pedí sin desconfigurar algo más" — nada de refactors o mejoras adyacentes.

## Global Constraints

- TypeScript estricto en todo el frontend.
- Componentes < 300 líneas (regla del proyecto).
- Tailwind + mobile-first + dark mode aware.
- Los tipos `WidgetInstance.config` son `Record<string, unknown>` — cada widget lee su propia key con cast.
- No romper submissions existentes: cualquier config nueva debe tener default backward-compatible.
- No cambiar el shape del value enviado por widgets existentes (los submissions guardados deben seguir funcionando).
- Todos los cambios deben respetar el registro central `widgetRegistry` en `src/components/widgets/registry.ts`.

## Arquitectura

Cambios distribuidos en 4 áreas independientes (una por widget). Ningún cambio comparte código entre widgets salvo la nueva constante `src/lib/countries.ts` (para el widget Teléfono) y un helper compartido de "render con saltos de línea" que aplicaremos al widget Párrafo. Los backends afectados son sólo `pdf-renderer.service.ts` y el exportador de Excel (para Párrafo).

Ningún cambio toca:
- Store global (`useBuilderStore`).
- Servicios de API o auth.
- Widgets no listados en este spec.
- Schema de Mongoose de submissions.

---

## Sección 1 — Widget "Texto": salto de línea opcional

### Objetivo
Permitir que el widget "Texto" pase de `<input>` a `<textarea>` cuando el admin active una nueva propiedad, **sin afectar** el resto de propiedades ya existentes.

### Archivos afectados
- `src/components/widgets/text/TextWidget.ts` — agregar `allowLineBreaks: false` a `defaultConfig`.
- `src/components/widgets/text/Text.properties.tsx` — agregar checkbox "Permitir salto de línea" (independiente de `allowSpecialChars`).
- `src/components/widgets/text/Text.render.tsx` — render condicional `<input>` vs `<textarea>`.
- `src/components/widgets/text/Text.preview.tsx` — preview del builder refleja el modo multilinea (deshabilitado, como hoy).

### Data flow
```
widget.config.allowLineBreaks: boolean (default false)
    │
    └── render:
         ├── false → <input type="text"> (comportamiento actual, sin cambios)
         └── true  → <textarea rows={3}> con mismo name/required/maxLength/placeholder/defaultValue
```

### Detalles

- El **filtrado de caracteres** (`allowNumbers`, `allowSpecialChars`) se preserva idéntico al modo `<input>` para el modo `<textarea>` (mismo handler `onKeyPress`). Enter no está en la lista de "special chars", así que no se filtra — pasa siempre.
- **maxLength** aplica igual en ambos modos (atributo nativo).
- El value guardado sigue siendo un string plano. Los `\n` viajan tal cual en el submission.

### Testing
- Render test: `allowLineBreaks=false` → renderiza `<input>`.
- Render test: `allowLineBreaks=true` → renderiza `<textarea rows=3>`.
- Interaction test: en modo `<textarea>`, presionar Enter dentro del campo NO dispara `onSubmit` del form y el `\n` queda en el value.

---

## Sección 2 — Widget "Párrafo": preservar salto de línea aguas abajo

### Objetivo
El `<textarea>` YA acepta Enter (verificado — no hay interceptor). El problema real es que el `\n` se pierde al mostrar el value guardado. Corregirlo en los 3 lugares donde se renderiza.

### Archivos afectados

- **Backend HTML del PDF:** `backend/src/submissions/submissions.service.ts` — el backend construye el HTML del PDF interpolando los valores del submission en `form.emailTemplate.pdfTemplate`. Necesitamos: (a) al interpolar el value de un widget tipo `textarea` en el HTML, aplicar `.replace(/\n/g, '<br/>')` **después** de escapar HTML; alternativamente (b) envolver el valor en `<span style="white-space: pre-wrap">...</span>`. Puppeteer (`pdf-renderer.service.ts`) no necesita cambios — sólo el que **genera** el HTML.
- **Backend Excel export:** `backend/src/submissions/excel-template.ts` (usa `xlsx` de SheetJS). Al escribir el value de un widget textarea, asegurar que el `\n` real llegue a la celda y que la celda tenga `alignment.wrapText = true`. En SheetJS eso es `ws[coord].s = { alignment: { wrapText: true } }` (require `cellStyles: true` al leer, ya usado). La `columnWidth` puede necesitar ajuste sólo si se ve mal.
- **Frontend — verificar en Task 2:** buscar en `src/components/userapp/MySubmissionsList.tsx`, `src/components/userapp/MyDraftsList.tsx` y `src/components/reports/*` si en algún lugar la UI muestra el valor crudo del textarea (grep `submission.data[widget.id]` o similar). Si sí, aplicar `whiteSpace: 'pre-wrap'` al contenedor. Si el frontend sólo muestra un preview truncado y el detalle completo abre el PDF, este ítem se marca N/A en el plan y sólo aplican los dos cambios de backend.

### Data flow
```
Usuario escribe "linea 1\nlinea 2" en textarea
    │
    ├── se envía al backend como string con \n literal
    │
    └── se muestra en 3 lugares:
         ├── tabla de submissions (front) → CSS white-space: pre-wrap
         ├── PDF descargado (back)        → \n → <br/> o pre-wrap en CSS del template
         └── Excel exportado (back)       → wrapText: true en la celda
```

### Detalles
- No se cambia el shape del value (sigue siendo string con `\n`).
- Solo cambian las capas de presentación.
- No es necesario tocar el schema ni migrar submissions existentes.

### Testing
- E2E: crear submission con "línea 1\nlínea 2" en widget textarea → verificar que:
  - En la tabla del panel de submissions, se ven 2 líneas.
  - En el PDF descargado, se ven 2 líneas.
  - En el Excel exportado, la celda muestra 2 líneas (con wrap).

---

## Sección 3 — Widget "Teléfono": selector de país opcional + validación bloqueante

### Objetivo
Agregar una opción activable ("selector de país") que:
1. Muestra al usuario final una bandera + prefijo + flecha desplegable a la izquierda del input.
2. Abre un modal buscable con ~25 países (LATAM + España + USA).
3. Valida bloqueantemente que el número escrito corresponda al país seleccionado.

Cuando la opción está **desactivada**, el widget se comporta **exactamente igual que hoy**: prefijo fijo del admin, sin selector, sin validación cruzada.

### Archivos afectados
- **Nuevo:** `src/lib/countries.ts` — constante con la lista de países.
- **Nuevo:** `src/components/widgets/phone/CountryPickerModal.tsx` — modal con búsqueda + lista + selección.
- `src/components/widgets/phone/PhoneWidget.ts` — agregar `enableCountrySelector: false` y `defaultCountry: "CO"` a `defaultConfig`.
- `src/components/widgets/phone/Phone.properties.tsx` — checkbox nuevo "Permitir al usuario cambiar país" + select "País por defecto" (visible solo si el checkbox está ON).
- `src/components/widgets/phone/Phone.render.tsx` — render condicional (con selector o sin selector) + validación.
- `src/components/widgets/phone/Phone.preview.tsx` — preview refleja el modo con selector si aplica.

### Lista de países

Fija en `src/lib/countries.ts`, ~25 entradas. Estructura:

```ts
export type Country = {
  code: string;       // ISO-3166-1 alpha-2: "CO", "US", "ES", ...
  name: string;       // "Colombia", "Estados Unidos", "España", ...
  dialCode: string;   // "+57", "+1", "+34", ...
  flag: string;       // emoji: "🇨🇴", "🇺🇸", "🇪🇸", ...
  pattern: RegExp;    // valida el número (sin el dial code)
  placeholder: string; // ejemplo visible: "300 123 4567"
};

export const COUNTRIES: Country[] = [
  // Colombia primero (default más común)
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴", pattern: /^3\d{9}$/, placeholder: "300 123 4567" },
  // Resto en orden alfabético
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", pattern: /^\d{10,11}$/, placeholder: "11 1234 5678" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴", pattern: /^[67]\d{7}$/, placeholder: "7 123 4567" },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷", pattern: /^\d{10,11}$/, placeholder: "11 91234 5678" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "DO", name: "República Dominicana", dialCode: "+1", flag: "🇩🇴", pattern: /^\d{10}$/, placeholder: "809 123 4567" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨", pattern: /^\d{9}$/, placeholder: "9 1234 5678" },
  { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸", pattern: /^[6-9]\d{8}$/, placeholder: "612 34 56 78" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽", pattern: /^\d{10}$/, placeholder: "55 1234 5678" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦", pattern: /^\d{7,8}$/, placeholder: "1234 5678" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷", pattern: /^\d{10}$/, placeholder: "787 123 4567" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸", pattern: /^\d{10}$/, placeholder: "555 123 4567" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾", pattern: /^9\d{7}$/, placeholder: "9 123 4567" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪", pattern: /^4\d{9}$/, placeholder: "412 123 4567" },
];
```

### Modal (`CountryPickerModal.tsx`)

- Usa `ModalShell` existente del proyecto.
- Header: título "Seleccionar país".
- Input de búsqueda (filtra por nombre o dialCode).
- Lista scrolleable: `flag + name + dialCode` por fila, click → selecciona y cierra.
- Mobile-first, ancho máx `max-w-sm`, alto máx 70vh.
- Cierra con click fuera o botón ✕.

### Data flow

**Modo desactivado (default, retrocompatible):**
```
config.enableCountrySelector = false
    │
    └── render idéntico al actual:
         <span>{config.prefix}</span> + <input type="tel" name={widget.id}>
    │
    └── value enviado: sólo el número (sin dial code)
```

**Modo activado:**
```
config.enableCountrySelector = true
config.defaultCountry = "CO"
    │
    ├── state local: selectedCountry = COUNTRIES.find(c => c.code === defaultCountry)
    │
    └── render:
         <button onClick={openModal}>{flag} {dialCode} ▾</button>
         + <input type="tel" name={widget.id} onChange={validate}>
         + <input type="hidden" name={widget.id + "_country"} value={selectedCountry.code}>
    │
    ├── onChange: validar contra selectedCountry.pattern
    │             si no matchea → setCustomValidity("El número no corresponde a {country.name}")
    │             si matchea    → setCustomValidity("")
    │
    └── click en botón → abre modal → selecciona país → cierra → re-valida input actual
```

### Validación bloqueante
- `setCustomValidity()` en el `<input>` — el HTML nativo bloquea el submit del form si hay validity error.
- Se muestra el mensaje debajo del input, en rojo, cuando el input tiene `:invalid` y el usuario ya intentó enviar (o hizo blur).
- **Warning visual** (rojo) se muestra tras primer blur, no mientras el usuario está escribiendo (evita ruido).

### Detalles
- El campo hidden `{widget.id}_country` es opcional y sólo aparece en modo con selector — permite al backend saber qué país eligió el usuario si necesita reconstruir el número internacional.
- Backward-compat: los submissions viejos siguen sin el campo `_country`; los nuevos con selector desactivado siguen igual que antes.
- No modificar el backend en este widget.

### Testing
- Render test: `enableCountrySelector=false` → NO renderiza botón, renderiza span como hoy.
- Render test: `enableCountrySelector=true` → renderiza botón con `flag + dialCode + ▾`.
- Interaction test: escribir "3001234567" con Colombia seleccionada → validity OK.
- Interaction test: escribir "5551234567" con Colombia seleccionada → validity error "no corresponde a Colombia".
- Interaction test: abrir modal, buscar "Est", seleccionar USA → prefix cambia a `+1`, número previamente inválido revalida.
- Interaction test: intentar submit del form con número inválido → form NO se envía.

---

## Sección 4 — Widget "Cédula" (`id_scanner`): mejor precisión OCR

### Objetivo
Mejorar la precisión de la extracción de datos sin cambiar el UX visible. Los botones "Usar cámara" / "Subir imagen" quedan idénticos.

### Archivos afectados
- `src/components/widgets/idscanner/IdScannerWidget.ts` — agregar `documentType: "auto"` a `defaultConfig`.
- `src/components/widgets/idscanner/IdScanner.properties.tsx` — agregar select "Tipo de documento" con opciones: `auto | cc | ce | ti | passport`.
- `src/components/widgets/idscanner/IdScanner.render.tsx` — aplicar todas las mejoras técnicas:
  - Preprocesamiento de imagen antes de Tesseract.
  - Config de Tesseract mejorada.
  - Regex de extracción por tipo de documento.
  - Validaciones visuales post-OCR.

### Mejoras técnicas

#### a) Resolución de captura
```ts
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: "environment" },
    width:  { ideal: 1920 },  // antes: 1280
    height: { ideal: 1080 },  // antes: implícito
  },
});
```

#### b) Preprocesamiento de imagen (canvas antes de Tesseract)

Función `preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement`:
1. Si `canvas.width < 1600` → upscale 2x con `imageSmoothingQuality: 'high'`.
2. Convertir a escala de grises: por cada pixel `RGB → gray = 0.299*R + 0.587*G + 0.114*B`.
3. Aumentar contraste: mapear el rango de intensidad del histograma al rango [0, 255] (autolevel simple).
4. Umbralización (binarización) con umbral fijo 180: `pixel < 180 → 0, else 255`.
5. Retornar el mismo canvas modificado (o uno nuevo si upscale).

#### c) Config Tesseract
```ts
Tesseract.recognize(processedCanvas, "spa", {
  logger: (m) => { ... },
  // @ts-expect-error tesseract options
  tessedit_pageseg_mode: "6", // uniform block of text — mejor para IDs
});
```

#### d) Regex mejorada por tipo de documento

Reemplazar `extractFromText(text, fields)` por `extractFromText(text, fields, documentType)`:

- **`cc` (Cédula de Ciudadanía Colombia):**
  - Número: `/\b\d{1,3}(?:[.\s]\d{3})+\b/` (con puntos/espacios: `1.234.567.890`) → normalizar quitando puntos/espacios → validar longitud 6-12.
  - Nombre: primera línea con **≥2 palabras** consecutivas en mayúsculas (regex `/^[A-ZÁÉÍÓÚÑ]+(\s+[A-ZÁÉÍÓÚÑ]+){1,}$/m`).
  - Fecha nacimiento: aceptar `dd/mm/yyyy`, `dd-mm-yyyy`, `dd MMM yyyy`, `yyyy-mm-dd`; priorizar años 1900-2026.

- **`ce` (Cédula de Extranjería):** igual que `cc` pero número puede tener letras (`[A-Z0-9]{6,12}`).

- **`ti` (Tarjeta de Identidad):** igual que `cc` pero acepta número de 10-11 dígitos y prioriza años 2005-2026 (menores).

- **`passport`:** intenta parsear la **MRZ** (Machine Readable Zone) — 2 líneas de 44 caracteres al pie del documento. Si detecta el patrón `P<[A-Z]{3}[A-Z<]+`, extrae apellido, nombre y número. Si no detecta MRZ, cae a regex genérica.

- **`auto` (default):** intenta los 4 tipos en orden `[cc, passport, ce, ti]` y se queda con el que extrajo **más campos no vacíos**. En empate, gana `cc`.

#### e) Validaciones visuales post-OCR (no bloqueantes)

Después de extraer, para cada campo:
- `numero`: si no es 6-12 dígitos o tiene caracteres raros → marcar en amarillo con tooltip "Verifica el número".
- `fechaNacimiento`: si no es fecha válida o año < 1900 o > 2026 → marcar en amarillo con tooltip "Verifica la fecha".
- `nombre`: si es < 5 caracteres o tiene sólo 1 palabra → marcar en amarillo con tooltip "Verifica el nombre".

El usuario puede corregir manualmente (ya lo permite `allowManual=true` que sigue por default).

### Data flow

```
Usuario abre cámara / sube imagen
    │
    ├── Captura → canvas (1920x1080 o resolución de archivo)
    │
    ├── preprocessImage(canvas) → canvas procesado (grayscale + contraste + binario)
    │
    ├── Tesseract.recognize(canvas procesado, "spa", { pageseg_mode: 6 })
    │
    ├── extractFromText(text, fields, documentType)
    │   │
    │   └── si documentType === "auto":
    │         intenta cc, passport, ce, ti → devuelve el mejor
    │
    ├── validatePostOcr(data) → marca campos sospechosos
    │
    └── setExtracted(data) → UI muestra inputs (amarillos si sospechosos)
```

### Detalles
- **Sin cambio en el value enviado** al form: sigue siendo un `<input type="hidden">` con el JSON de campos extraídos. Los submissions viejos siguen siendo compatibles.
- **No usamos librerías nuevas** — todo el preprocesamiento está en canvas API nativa. Tesseract.js sigue siendo la única dep (ya está en el proyecto).
- El overhead del preprocesamiento es despreciable (<100ms).

### Testing
- Unit test: `preprocessImage` — dado un canvas de test, verificar que el output es grayscale + binario.
- Unit test: `extractFromText` con muestras de texto OCR (fixtures) para cada tipo de documento — verificar que extrae los campos correctos.
- Unit test: `extractFromText` con `documentType: "auto"` — verificar que elige el tipo que más campos extrae.
- Unit test: `validatePostOcr` — verificar que marca campos con formatos sospechosos.
- E2E manual (Sara): probar con foto de una cédula real → confirmar que captura mejor que antes.

---

## Error handling

- **Texto:** no aplica (cambio puramente estructural).
- **Párrafo:** si el value no tiene `\n`, se renderiza igual que antes; si tiene `\n`, respeta las líneas. Sin errores nuevos.
- **Teléfono:**
  - Si el país por defecto configurado no existe en la lista, cae a Colombia (fallback).
  - Si el usuario intenta enviar el form con número inválido → form no se envía (HTML native validity), mensaje visible.
- **Cédula:**
  - Si Tesseract falla → mismo comportamiento que hoy (estado `error`, botón "Intentar de nuevo").
  - Si el preprocesamiento falla → cae al canvas sin procesar (try/catch).
  - Si ningún tipo de documento extrajo campos → resultado vacío, usuario puede llenar manualmente (`allowManual`).

## Backward compatibility

- Todos los `defaultConfig` nuevos son `false`, `"auto"` u opciones desactivadas por defecto.
- Formularios y submissions existentes se comportan **exactamente igual** que hoy si nadie toca las nuevas propiedades.
- No hay migraciones de datos.

## Fuera de alcance

Explícitamente NO incluidos (Sara pidió "sin desconfigurar algo más"):

- Refactor de widgets no listados.
- Cambios en el store global, servicios, auth.
- Nuevos tipos de widget.
- Cambios en flujos de tareas, share links, etc.
- Nuevas dependencias npm (todo con lo ya instalado).
- Cambios en el schema de Mongoose.

## Deliverable esperado por fase (para el plan)

Cada sección arriba corresponde a **una task** del plan de implementación:

1. Task 1 — Texto: salto de línea
2. Task 2 — Párrafo: preservar `\n` en frontend detalle + PDF + Excel
3. Task 3 — Teléfono: selector de país opcional + validación
4. Task 4 — Cédula: mejor OCR

Cada task es independiente, testeable, y termina con commit propio.
