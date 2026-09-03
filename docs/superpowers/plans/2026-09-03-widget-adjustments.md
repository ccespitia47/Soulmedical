# Ajustes de Widgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 4 ajustes acotados en widgets del builder de formularios (Texto, Párrafo, Teléfono, Cédula) sin afectar nada fuera del alcance definido.

**Architecture:** 4 tasks independientes. Task 1, 3 y 4 son puramente frontend (widgets aislados). Task 2 toca backend (interpolador PDF + generador Excel). Ninguna task depende de otra.

**Tech Stack:** React 19 + TypeScript estricto + Tailwind (frontend); NestJS 11 + Mongoose + ExcelJS + Puppeteer (backend); Tesseract.js (OCR ya instalado).

**Spec:** `docs/superpowers/specs/2026-09-03-widget-adjustments-design.md`

## Global Constraints

- **TypeScript estricto**: sin `any`, sin `@ts-ignore` (usar `@ts-expect-error` con comentario si es necesario para libs sin tipos).
- **No romper submissions existentes**: cualquier `defaultConfig` nuevo debe ser retrocompatible (default = comportamiento anterior).
- **No cambiar el shape del value enviado por widgets existentes** (submissions guardados siguen funcionando).
- **No agregar dependencias npm nuevas** — todo con lo ya instalado.
- **Componentes < 300 líneas** (regla del proyecto en `.claude/rules/frontend.md`).
- **Commits atómicos**: 1 commit por task.
- **No tocar** el store global, servicios de auth, otros widgets, o el schema de Mongoose de submissions.
- **Mensajes de UI en español** (proyecto es en español).

---

## File Structure

**Task 1 (Widget Texto):**
- Modify: `src/components/widgets/text/TextWidget.ts`
- Modify: `src/components/widgets/text/Text.properties.tsx`
- Modify: `src/components/widgets/text/Text.render.tsx`
- Modify: `src/components/widgets/text/Text.preview.tsx`

**Task 2 (Widget Párrafo — backend):**
- Modify: `backend/src/submissions/pdf-interpolator.ts`
- Modify: `backend/src/reports/report-columns.ts`
- Modify: `backend/src/reports/reports.service.ts`
- Modify: `backend/src/submissions/pdf-interpolator.spec.ts`

**Task 3 (Widget Teléfono):**
- Create: `src/lib/countries.ts`
- Create: `src/components/widgets/phone/CountryPickerModal.tsx`
- Modify: `src/components/widgets/phone/PhoneWidget.ts`
- Modify: `src/components/widgets/phone/Phone.properties.tsx`
- Modify: `src/components/widgets/phone/Phone.render.tsx`
- Modify: `src/components/widgets/phone/Phone.preview.tsx`

**Task 4 (Widget Cédula):**
- Modify: `src/components/widgets/idscanner/IdScannerWidget.ts`
- Modify: `src/components/widgets/idscanner/IdScanner.properties.tsx`
- Modify: `src/components/widgets/idscanner/IdScanner.render.tsx`

---

## Task 1: Widget Texto — Salto de línea opcional

**Files:**
- Modify: `src/components/widgets/text/TextWidget.ts`
- Modify: `src/components/widgets/text/Text.properties.tsx`
- Modify: `src/components/widgets/text/Text.render.tsx`
- Modify: `src/components/widgets/text/Text.preview.tsx`

**Interfaces:**
- Consumes: `WidgetInstance.config: Record<string, unknown>` de `src/types/widget.types.ts`
- Produces: nueva key `allowLineBreaks: boolean` (default `false`) en `TextWidget.defaultConfig`. Widget sigue rindiendo el mismo `<input name={widget.id}>` cuando la key es `false`; renderiza `<textarea>` cuando es `true`.

- [ ] **Step 1: Agregar `allowLineBreaks` al `defaultConfig`**

Modificar `src/components/widgets/text/TextWidget.ts`. Reemplazar el bloque `defaultConfig` completo:

```ts
  defaultConfig: {
    placeholder: "",
    defaultValue: "",
    maxLength: 100,
    allowNumbers: false,
    allowSpecialChars: false,
    allowLineBreaks: false,
  },
```

- [ ] **Step 2: Agregar checkbox "Permitir salto de línea" en el panel de propiedades**

En `src/components/widgets/text/Text.properties.tsx`, después del `<label>` del checkbox "Permitir caracteres especiales" (que termina en la línea con `</label>` cerca del final del componente, antes del `</>`), agregar un checkbox nuevo:

```tsx
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        <input
          type="checkbox"
          checked={(widget.config.allowLineBreaks as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, allowLineBreaks: e.target.checked },
            })
          }
        />
        <span>Permitir salto de línea</span>
      </label>
```

- [ ] **Step 3: Render condicional `<input>` vs `<textarea>` en `Text.render.tsx`**

Reemplazar el contenido completo de `src/components/widgets/text/Text.render.tsx` con:

```tsx
import type { WidgetRenderProps } from "../../../types/widget.types";

export default function TextRender({ widget }: WidgetRenderProps) {
  const allowNumbers = (widget.config.allowNumbers as boolean) || false;
  const allowSpecialChars = (widget.config.allowSpecialChars as boolean) || false;
  const allowLineBreaks = (widget.config.allowLineBreaks as boolean) || false;

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Si se permiten ambos, no filtrar nada (Enter no es un "char" en input,
    // pero en textarea sí — y no debe bloquearse porque genera salto de línea).
    if (allowNumbers && allowSpecialChars) return;

    const char = e.key;

    // Enter en textarea siempre pasa (permite el salto de línea nativo).
    if (allowLineBreaks && char === "Enter") return;

    const isLetter = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]$/.test(char);
    const isNumber = /^[0-9]$/.test(char);
    const isSpace = char === " ";
    const specialChars = "@#$%&*()_+=-{}[];':\"\\|,.<>/?!¡¿";
    const isSpecialChar = specialChars.includes(char);

    let allowed = isLetter || isSpace;
    if (allowNumbers) allowed = allowed || isNumber;
    if (allowSpecialChars) allowed = allowed || isSpecialChar;

    if (!allowed) e.preventDefault();
  };

  const commonStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 13.5,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {allowLineBreaks ? (
        <textarea
          name={widget.id}
          required={widget.required}
          placeholder={(widget.config.placeholder as string) || ""}
          defaultValue={(widget.config.defaultValue as string) || ""}
          maxLength={(widget.config.maxLength as number) || undefined}
          rows={3}
          onKeyPress={handleKeyPress}
          style={{ ...commonStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          name={widget.id}
          required={widget.required}
          placeholder={(widget.config.placeholder as string) || ""}
          defaultValue={(widget.config.defaultValue as string) || ""}
          maxLength={(widget.config.maxLength as number) || undefined}
          onKeyPress={handleKeyPress}
          style={commonStyle}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Preview del builder refleja modo multilinea**

Reemplazar el contenido completo de `src/components/widgets/text/Text.preview.tsx` con:

```tsx
import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function TextPreview({ widget }: WidgetPreviewProps) {
  const allowLineBreaks = (widget.config.allowLineBreaks as boolean) || false;

  const commonStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 13.5,
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
    cursor: "not-allowed" as const,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "12px" }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {allowLineBreaks ? (
        <textarea
          disabled
          placeholder={(widget.config.placeholder as string) || "Texto..."}
          rows={3}
          style={{ ...commonStyle, resize: "none" }}
        />
      ) : (
        <input
          type="text"
          disabled
          placeholder={(widget.config.placeholder as string) || "Texto..."}
          style={commonStyle}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar type-check y build**

Correr en el terminal (PowerShell) desde `c:\proyectos\Soulmedical`:

```powershell
npx tsc --noEmit
```

Expected: sale con exit 0, sin errores.

Luego:
```powershell
npm run build
```

Expected: build OK, genera `dist/`.

- [ ] **Step 6: Verificación manual en navegador**

1. Abrir el builder de un formulario, arrastrar un widget "Texto".
2. En el panel de propiedades, marcar "Permitir salto de línea".
3. Guardar/publicar el formulario.
4. Abrir el formulario para llenar → verificar que el input se ve como textarea multilinea.
5. Escribir texto con Enter → verificar que hace salto de línea real.
6. Desmarcar el checkbox y publicar de nuevo → verificar que vuelve a ser input una línea.

- [ ] **Step 7: Commit**

```bash
git add src/components/widgets/text/TextWidget.ts src/components/widgets/text/Text.properties.tsx src/components/widgets/text/Text.render.tsx src/components/widgets/text/Text.preview.tsx
git commit -m "feat(widget-text): nueva prop allowLineBreaks (input -> textarea)"
```

---

## Task 2: Widget Párrafo — Preservar `\n` en PDF y Excel

**Files:**
- Modify: `backend/src/submissions/pdf-interpolator.ts`
- Modify: `backend/src/submissions/pdf-interpolator.spec.ts`
- Modify: `backend/src/reports/report-columns.ts`
- Modify: `backend/src/reports/reports.service.ts`

**Interfaces:**
- Consumes: `ReportColumn` de `backend/src/reports/report-columns.ts`; interpolador PDF de `pdf-interpolator.ts`.
- Produces: campo opcional `ReportColumn.wrapText?: boolean` — `reports.service.ts` lo lee para aplicar wrap-text en celdas de textarea. Además, el interpolador PDF ahora convierte `\n` → `<br/>` en cualquier valor de string (no solo textarea — es transversal e inocuo).

### Investigación previa (obligatoria antes del Step 1)

- [ ] **Step 0: Verificar si hay UI en frontend que muestre el valor crudo de un submission**

Correr desde `c:\proyectos\Soulmedical` (PowerShell):

```powershell
Select-String -Path "src\components\**\*.tsx" -Pattern "submission\.data\[|sub\.data\[|entry\.data\[" -SimpleMatch
```

**Si retorna resultados:** anotar los archivos y aplicar `whiteSpace: 'pre-wrap'` al contenedor donde se pinta el value. Agregar Step 5b para modificarlos.

**Si NO retorna resultados:** el frontend muestra los detalles vía PDF descargable, no hay que tocar nada del frontend. Continuar con Step 1 (Backend PDF).

### Cambios PDF

- [ ] **Step 1: Escribir test failing para el interpolador de PDF**

Abrir `backend/src/submissions/pdf-interpolator.spec.ts`. Agregar (al final del `describe` principal) el siguiente test. Si no hay `describe`, agregarlo al final del archivo dentro de un nuevo `describe('interpolatePdfTemplate — line breaks', () => { ... })`:

```ts
  it('convierte \\n a <br/> en valores interpolados (para preservar párrafos)', async () => {
    const html = await interpolatePdfTemplate({
      template: 'Observaciones: ${observaciones}',
      data: { w1: 'Línea 1\nLínea 2\nLínea 3' },
      widgets: [{ id: 'w1', label: 'Observaciones', type: 'textarea' }],
      filesService: {} as never,
    });
    expect(html).toBe('Observaciones: Línea 1<br/>Línea 2<br/>Línea 3');
  });

  it('escapa HTML antes de convertir saltos de línea (no permite inyección)', async () => {
    const html = await interpolatePdfTemplate({
      template: '${obs}',
      data: { w1: '<script>alert(1)</script>\nsegunda' },
      widgets: [{ id: 'w1', label: 'obs', type: 'textarea' }],
      filesService: {} as never,
    });
    expect(html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;<br/>segunda');
  });
```

- [ ] **Step 2: Correr test para verificar que falla**

Desde `c:\proyectos\Soulmedical\backend`:

```powershell
npx jest src/submissions/pdf-interpolator.spec.ts -t "line breaks"
```

Expected: los 2 tests fallan porque `\n` no se convierte hoy.

- [ ] **Step 3: Implementar cambio en `pdf-interpolator.ts`**

Editar `backend/src/submissions/pdf-interpolator.ts`. Localizar la línea 98 (dentro de `resolveValue`, la última línea antes del cierre `}`):

```ts
  return escapeHtml(str);
```

Reemplazarla por:

```ts
  // Convierte \n a <br/> DESPUÉS de escapar. Si el value venía con <br/>
  // literal del usuario, escapeHtml ya lo convirtió a &lt;br/&gt; y esta
  // sustitución no lo toca (solo actúa sobre newlines reales). Aplicar
  // transversalmente a todos los widgets es inocuo — valores sin \n no cambian.
  return escapeHtml(str).replace(/\n/g, '<br/>');
```

- [ ] **Step 4: Correr los 2 tests para verificar que pasan**

```powershell
npx jest src/submissions/pdf-interpolator.spec.ts -t "line breaks"
```

Expected: PASS.

- [ ] **Step 5: Correr TODOS los tests de pdf-interpolator para asegurar no romper existentes**

```powershell
npx jest src/submissions/pdf-interpolator.spec.ts
```

Expected: TODOS pasan (incluyendo los previos).

### Cambios Excel

- [ ] **Step 6: Extender `ReportColumn` con `wrapText?: boolean`**

Editar `backend/src/reports/report-columns.ts`. Localizar el tipo `ReportColumn` (alrededor de línea 22-26):

```ts
export type ReportColumn = {
  header: string;
  key: string;
  value: (data: Record<string, unknown> | undefined) => string;
};
```

Reemplazarlo por:

```ts
export type ReportColumn = {
  header: string;
  key: string;
  value: (data: Record<string, unknown> | undefined) => string;
  // Si true, la celda se genera con alignment.wrapText en ExcelJS para
  // que los \n del contenido se muestren como saltos reales dentro de la celda.
  // Aplica a widgets tipo textarea.
  wrapText?: boolean;
};
```

- [ ] **Step 7: Marcar `wrapText: true` para widgets textarea en `buildReportColumns`**

En el mismo archivo `backend/src/reports/report-columns.ts`, localizar el bloque `else { const widgetId = f.id; cols.push({ ... }) }` (alrededor de línea 132-139). Reemplazarlo por:

```ts
    } else {
      const widgetId = f.id;
      cols.push({
        header: f.label,
        key: widgetId,
        value: (data) => stringifyCell(data?.[widgetId]),
        wrapText: f.type === 'textarea',
      });
    }
```

- [ ] **Step 8: Aplicar `wrapText` en las celdas al construir el Excel**

Editar `backend/src/reports/reports.service.ts`. Localizar el bloque del loop de submissions (alrededor de líneas 297-306):

```ts
    for await (const batch of this.iterSubmissions(formId, taskId)) {
      for (const sub of batch) {
        const data = sub.data as Record<string, unknown> | undefined;
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.key] = col.value(data);
        }
        ws.addRow(row);
      }
    }
```

Reemplazarlo por:

```ts
    // Precomputar las keys de columnas que necesitan wrapText — así solo
    // iteramos esas celdas por fila en vez de mapear todas.
    const wrapKeys = columns.filter((c) => c.wrapText).map((c) => c.key);

    for await (const batch of this.iterSubmissions(formId, taskId)) {
      for (const sub of batch) {
        const data = sub.data as Record<string, unknown> | undefined;
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col.key] = col.value(data);
        }
        const excelRow = ws.addRow(row);
        // Aplicar wrapText a las celdas de widgets textarea para que
        // los \n se pinten como saltos reales dentro de la celda.
        for (const key of wrapKeys) {
          excelRow.getCell(key).alignment = { wrapText: true, vertical: 'top' };
        }
      }
    }
```

- [ ] **Step 9: Correr todos los tests del backend**

Desde `c:\proyectos\Soulmedical\backend`:

```powershell
npx jest
```

Expected: TODOS los tests pasan (incluyendo los tests preexistentes de reports, submissions, etc.).

- [ ] **Step 10: Verificar type-check + build backend**

```powershell
npx tsc --noEmit
npm run build
```

Expected: ambos con exit 0.

- [ ] **Step 11: Verificación manual E2E (requiere reiniciar backend)**

1. Reiniciar el backend (Tarea Programada SYSTEM — instrucciones en memoria de deploy).
2. Abrir un formulario que tenga un widget Párrafo (textarea).
3. Llenar el textarea con: `"Línea 1\nLínea 2\nLínea 3"` (presionar Enter entre líneas realmente).
4. Enviar el formulario.
5. **Descargar PDF** del submission → verificar que se ven 3 líneas separadas.
6. **Descargar Excel** de las submissions → abrir en Excel/LibreOffice, verificar que la celda del párrafo muestra 3 líneas (con wrap).

- [ ] **Step 12: Commit**

```bash
git add backend/src/submissions/pdf-interpolator.ts backend/src/submissions/pdf-interpolator.spec.ts backend/src/reports/report-columns.ts backend/src/reports/reports.service.ts
git commit -m "fix(reports): preservar saltos de linea en textarea (PDF <br/>, Excel wrapText)"
```

---

## Task 3: Widget Teléfono — Selector de país opcional + validación bloqueante

**Files:**
- Create: `src/lib/countries.ts`
- Create: `src/components/widgets/phone/CountryPickerModal.tsx`
- Modify: `src/components/widgets/phone/PhoneWidget.ts`
- Modify: `src/components/widgets/phone/Phone.properties.tsx`
- Modify: `src/components/widgets/phone/Phone.render.tsx`
- Modify: `src/components/widgets/phone/Phone.preview.tsx`

**Interfaces:**
- Consumes: `WidgetInstance.config`; `WidgetRenderProps`, `WidgetPropertiesProps`, `WidgetPreviewProps` de `src/types/widget.types.ts`.
- Produces:
  - Módulo público `src/lib/countries.ts` con `type Country = { code: string; name: string; dialCode: string; flag: string; pattern: RegExp; placeholder: string }` y `export const COUNTRIES: Country[]`.
  - Nuevas keys en `PhoneWidget.defaultConfig`: `enableCountrySelector: false`, `defaultCountry: "CO"`. Comportamiento por default = idéntico al actual.
  - Cuando `enableCountrySelector = true`, además del `<input name={widget.id}>` con el número, se emite un `<input type="hidden" name={widget.id + "_country"}>` con el `code` del país (ISO alpha-2).

- [ ] **Step 1: Crear la constante de países**

Crear el archivo `src/lib/countries.ts` con el contenido:

```ts
export type Country = {
  code: string;        // ISO 3166-1 alpha-2
  name: string;
  dialCode: string;    // con "+"
  flag: string;        // emoji
  pattern: RegExp;     // valida el número (sin el dialCode, solo dígitos)
  placeholder: string;
};

// Colombia primero (mercado principal). Resto alfabético por name.
export const COUNTRIES: Country[] = [
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴", pattern: /^3\d{9}$/, placeholder: "300 123 4567" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", pattern: /^\d{10,11}$/, placeholder: "11 1234 5678" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴", pattern: /^[67]\d{7}$/, placeholder: "7 123 4567" },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷", pattern: /^\d{10,11}$/, placeholder: "11 91234 5678" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "DO", name: "República Dominicana", dialCode: "+1", flag: "🇩🇴", pattern: /^\d{10}$/, placeholder: "809 123 4567" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨", pattern: /^\d{9}$/, placeholder: "9 1234 5678" },
  { code: "ES", name: "España", dialCode: "+34", flag: "🇪🇸", pattern: /^[6-9]\d{8}$/, placeholder: "612 34 56 78" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸", pattern: /^\d{10}$/, placeholder: "555 123 4567" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽", pattern: /^\d{10}$/, placeholder: "55 1234 5678" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮", pattern: /^\d{8}$/, placeholder: "1234 5678" },
  { code: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦", pattern: /^\d{7,8}$/, placeholder: "1234 5678" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪", pattern: /^9\d{8}$/, placeholder: "9 1234 5678" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷", pattern: /^\d{10}$/, placeholder: "787 123 4567" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾", pattern: /^9\d{7}$/, placeholder: "9 123 4567" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪", pattern: /^4\d{9}$/, placeholder: "412 123 4567" },
];

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}
```

- [ ] **Step 2: Crear el modal de selección de país**

Crear el archivo `src/components/widgets/phone/CountryPickerModal.tsx` con el contenido:

```tsx
import { useState, useMemo } from "react";
import { COUNTRIES, type Country } from "../../../lib/countries";

type Props = {
  selectedCode: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

export default function CountryPickerModal({ selectedCode, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [query]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "90%",
          maxWidth: 380,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Seleccionar país
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: "#6b7280",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
          <input
            autoFocus
            type="text"
            placeholder="Buscar por nombre o código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1.5px solid #e2e8f0",
              borderRadius: 6,
              fontSize: 13.5,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Sin resultados
            </p>
          ) : (
            filtered.map((c) => {
              const isSelected = c.code === selectedCode;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onSelect(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    background: isSelected ? "#f0fdfa" : "transparent",
                    cursor: "pointer",
                    fontSize: 13.5,
                    color: "#111827",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ color: "#6b7280", fontFamily: "monospace" }}>{c.dialCode}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Agregar `enableCountrySelector` y `defaultCountry` al `defaultConfig`**

Editar `src/components/widgets/phone/PhoneWidget.ts`. Reemplazar el bloque `defaultConfig`:

```ts
  defaultConfig: {
    placeholder: "300 123 4567",
    prefix: "+57",
    maxLength: 10,
    enableCountrySelector: false,
    defaultCountry: "CO",
  },
```

- [ ] **Step 4: Agregar controles al panel de propiedades**

Editar `src/components/widgets/phone/Phone.properties.tsx`. Justo antes del `<label>` final del checkbox "Campo obligatorio" (línea ~78-96), agregar:

```tsx
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={(widget.config.enableCountrySelector as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, enableCountrySelector: e.target.checked },
            })
          }
        />
        <span>Permitir al usuario cambiar país</span>
      </label>

      {(widget.config.enableCountrySelector as boolean) && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>País por defecto</label>
          <select
            style={inputStyle}
            value={(widget.config.defaultCountry as string) || "CO"}
            onChange={(e) =>
              updateWidget(widget.id, {
                config: { ...widget.config, defaultCountry: e.target.value },
              })
            }
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.dialCode})
              </option>
            ))}
          </select>
        </div>
      )}
```

Además, agregar el import al inicio del archivo (después del import existente):

```ts
import { COUNTRIES } from "../../../lib/countries";
```

- [ ] **Step 5: Render condicional con selector + validación bloqueante**

Reemplazar el contenido completo de `src/components/widgets/phone/Phone.render.tsx` con:

```tsx
import { useState, useRef, useEffect } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import { COUNTRIES, findCountry, type Country } from "../../../lib/countries";
import CountryPickerModal from "./CountryPickerModal";

export default function PhoneRender({ widget }: WidgetRenderProps) {
  const enableSelector = (widget.config.enableCountrySelector as boolean) || false;
  const defaultCode = (widget.config.defaultCountry as string) || "CO";
  const legacyPrefix = (widget.config.prefix as string) || "+57";
  const configuredPlaceholder = (widget.config.placeholder as string) || "";

  const [country, setCountry] = useState<Country>(() => findCountry(defaultCode));
  const [modalOpen, setModalOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cuando cambia el país, re-validar el value actual contra el nuevo pattern.
  useEffect(() => {
    if (!enableSelector || !inputRef.current) return;
    validate(value, country);
  }, [country.code, enableSelector, value]);

  function validate(v: string, c: Country) {
    if (!inputRef.current) return;
    if (v === "" || c.pattern.test(v)) {
      inputRef.current.setCustomValidity("");
    } else {
      inputRef.current.setCustomValidity(
        `El número no corresponde a ${c.name}`,
      );
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/^\d+$/.test(pasted)) e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (enableSelector) validate(v, country);
  };

  const showError =
    enableSelector && touched && value !== "" && !country.pattern.test(value);

  // Longitud máxima calculada del pattern (o fallback config.maxLength / 10).
  // Extrae el número final del regex simple del país. Es best-effort.
  const inferredMaxLength = (() => {
    const src = country.pattern.source;
    const m = src.match(/\{?(\d+)(?:,(\d+))?\}?\$/);
    if (m) return parseInt(m[2] ?? m[1], 10);
    return (widget.config.maxLength as number) || 15;
  })();

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {enableSelector ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={`Cambiar país (actual: ${country.name})`}
            style={{
              padding: "8px 10px",
              border: "1.5px solid #e2e8f0",
              borderRight: "none",
              borderRadius: "6px 0 0 6px",
              fontSize: 13.5,
              backgroundColor: "#f1f5f9",
              color: "#111827",
              fontWeight: 500,
              lineHeight: "1.5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 16 }}>{country.flag}</span>
            <span>{country.dialCode}</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>▾</span>
          </button>
        ) : (
          <span
            style={{
              padding: "8px 10px",
              border: "1.5px solid #e2e8f0",
              borderRight: "none",
              borderRadius: "6px 0 0 6px",
              fontSize: 13.5,
              backgroundColor: "#f1f5f9",
              color: "#111827",
              fontWeight: 500,
              lineHeight: "1.5",
            }}
          >
            {legacyPrefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="tel"
          name={widget.id}
          required={widget.required}
          placeholder={configuredPlaceholder || (enableSelector ? country.placeholder : "300 123 4567")}
          maxLength={enableSelector ? inferredMaxLength : (widget.config.maxLength as number) || 10}
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: `1.5px solid ${showError ? "#ef4444" : "#e2e8f0"}`,
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            boxSizing: "border-box",
          }}
        />
      </div>
      {showError && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>
          El número no corresponde a {country.name}
        </p>
      )}
      {enableSelector && (
        <input type="hidden" name={`${widget.id}_country`} value={country.code} />
      )}
      {modalOpen && (
        <CountryPickerModal
          selectedCode={country.code}
          onSelect={(c) => {
            setCountry(c);
            setModalOpen(false);
            // Re-focus el input para que el usuario siga tipeando.
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Preview del builder refleja modo con selector**

Reemplazar el contenido completo de `src/components/widgets/phone/Phone.preview.tsx` con:

```tsx
import type { WidgetPreviewProps } from "../../../types/widget.types";
import { findCountry } from "../../../lib/countries";

export default function PhonePreview({ widget }: WidgetPreviewProps) {
  const enableSelector = (widget.config.enableCountrySelector as boolean) || false;
  const defaultCode = (widget.config.defaultCountry as string) || "CO";
  const country = findCountry(defaultCode);
  const legacyPrefix = (widget.config.prefix as string) || "+57";
  const placeholder = (widget.config.placeholder as string) ||
    (enableSelector ? country.placeholder : "300 123 4567");

  return (
    <div style={{ padding: "12px" }}>
      <label style={{
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 6,
      }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span
          style={{
            padding: "8px 10px",
            border: "1.5px solid #e2e8f0",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            fontSize: 13.5,
            backgroundColor: "#f1f5f9",
            color: "#111827",
            fontWeight: 500,
            lineHeight: "1.5",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {enableSelector ? (
            <>
              <span style={{ fontSize: 16 }}>{country.flag}</span>
              <span>{country.dialCode}</span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>▾</span>
            </>
          ) : (
            legacyPrefix
          )}
        </span>
        <input
          type="tel"
          disabled
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            backgroundColor: "#f9fafb",
            color: "#9ca3af",
            cursor: "not-allowed",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verificar type-check y build**

Desde `c:\proyectos\Soulmedical`:

```powershell
npx tsc --noEmit
npm run build
```

Expected: ambos con exit 0.

- [ ] **Step 8: Verificación manual E2E**

1. En el builder, arrastrar un widget "Teléfono".
2. **Sin activar** el checkbox de selector → publicar → llenar → verificar que se ve idéntico al hoy (prefijo `+57` fijo).
3. Activar el checkbox "Permitir al usuario cambiar país" → elegir "México" como default → publicar.
4. Llenar el formulario:
   - El prefijo aparece con bandera 🇲🇽 +52 ▾.
   - Escribir `5551234567` (número válido MX) → no debe haber error.
   - Escribir `3001234567` (formato colombiano) → sale error rojo "no corresponde a México" y bloquea el submit.
   - Click en el botón del prefijo → abre modal.
   - Buscar "Col" → aparece Colombia → seleccionar → el prefijo cambia a 🇨🇴 +57.
   - El número `3001234567` ahora es válido para Colombia → error desaparece → submit funciona.
5. Confirmar en la submission guardada que se envió tanto el número como el campo `_country`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/countries.ts src/components/widgets/phone/CountryPickerModal.tsx src/components/widgets/phone/PhoneWidget.ts src/components/widgets/phone/Phone.properties.tsx src/components/widgets/phone/Phone.render.tsx src/components/widgets/phone/Phone.preview.tsx
git commit -m "feat(widget-phone): selector de pais opcional (LATAM+ES+US) con validacion bloqueante"
```

---

## Task 4: Widget Cédula — Mejor precisión de OCR

**Files:**
- Modify: `src/components/widgets/idscanner/IdScannerWidget.ts`
- Modify: `src/components/widgets/idscanner/IdScanner.properties.tsx`
- Modify: `src/components/widgets/idscanner/IdScanner.render.tsx`
- Create: `src/components/widgets/idscanner/IdScanner.ocr.ts` (helpers puros: preprocesamiento + extracción por tipo + validación post-OCR)

**Interfaces:**
- Consumes: `WidgetInstance.config`; `WidgetRenderProps`, `WidgetPropertiesProps`.
- Produces: nueva key `documentType: "auto" | "cc" | "ce" | "ti" | "passport"` (default `"auto"`) en `IdScannerWidget.defaultConfig`. El shape del value enviado al form (`<input type="hidden">` con JSON de campos extraídos) NO cambia — backward-compat total.

- [ ] **Step 1: Agregar `documentType` al `defaultConfig`**

Editar `src/components/widgets/idscanner/IdScannerWidget.ts`. Reemplazar el bloque `defaultConfig`:

```ts
  defaultConfig: {
    fields: ["nombre", "numero", "fechaNacimiento"],
    allowManual: true,
    documentType: "auto",
  },
```

- [ ] **Step 2: Agregar select "Tipo de documento" al panel de propiedades**

Editar `src/components/widgets/idscanner/IdScanner.properties.tsx`. Justo antes del bloque final que dice `<div style={{ padding: "10px 12px", background: "#fffbeb", ... }}>` (banner amarillo con el tip de Tesseract), agregar:

```tsx
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Tipo de documento</label>
        <select
          style={inputStyle}
          value={(widget.config.documentType as string) || "auto"}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, documentType: e.target.value },
            })
          }
        >
          <option value="auto">Detectar automáticamente</option>
          <option value="cc">Cédula de Ciudadanía (Colombia)</option>
          <option value="ce">Cédula de Extranjería (Colombia)</option>
          <option value="ti">Tarjeta de Identidad (menores)</option>
          <option value="passport">Pasaporte / Internacional</option>
        </select>
      </div>
```

- [ ] **Step 3a: Crear `IdScanner.ocr.ts` con helpers puros (sin React)**

Crear el archivo `src/components/widgets/idscanner/IdScanner.ocr.ts` con el contenido:

```ts
export type DocumentType = "auto" | "cc" | "ce" | "ti" | "passport";

type ExtractResult = { fields: Record<string, string>; matchCount: number };

// ─── Preprocesamiento de imagen (canvas nativo) ─────────────────────────────
// El pipeline: upscale si es pequeña → grayscale → autolevel → binarización.
// Todo se aplica in-place sobre el canvas (o uno nuevo si upscale). Coste:
// < 100ms para 1920x1080. Sin dependencias externas.
export function preprocessImage(source: HTMLCanvasElement): HTMLCanvasElement {
  const upscaled = source.width < 1600 ? upscale(source, 2) : source;
  const ctx = upscaled.getContext("2d");
  if (!ctx) return upscaled;
  const imgData = ctx.getImageData(0, 0, upscaled.width, upscaled.height);
  const data = imgData.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    data[i] = data[i + 1] = data[i + 2] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((data[i] - min) * 255) / range;
    const binary = stretched < 180 ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = binary;
  }

  ctx.putImageData(imgData, 0, 0);
  return upscaled;
}

function upscale(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width * factor;
  out.height = source.height * factor;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

// ─── Extracción por tipo de documento ───────────────────────────────────────

function extractCC(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (wantedFields.includes("numero")) {
    const dotted = text.match(/\b\d{1,3}(?:[.\s]\d{3}){2,3}\b/);
    if (dotted) {
      const num = dotted[0].replace(/[.\s]/g, "");
      if (num.length >= 6 && num.length <= 12) result.numero = num;
    } else {
      const plain = text.match(/\b\d{6,12}\b/);
      if (plain) result.numero = plain[0];
    }
  }

  if (wantedFields.includes("nombre")) {
    const nameLine = lines.find((l) =>
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,}$/.test(l),
    );
    if (nameLine) result.nombre = nameLine;
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  if (wantedFields.includes("sexo")) {
    const upper = text.toUpperCase();
    if (upper.includes("MASCULINO") || /\bM\b/.test(upper)) result.sexo = "Masculino";
    else if (upper.includes("FEMENINO") || /\bF\b/.test(upper)) result.sexo = "Femenino";
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function extractCE(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (wantedFields.includes("numero")) {
    const m = text.match(/\b[A-Z0-9]{6,12}\b/);
    if (m && /\d/.test(m[0])) result.numero = m[0];
  }

  if (wantedFields.includes("nombre")) {
    const nameLine = lines.find((l) =>
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,}$/.test(l),
    );
    if (nameLine) result.nombre = nameLine;
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function extractTI(text: string, wantedFields: string[]): ExtractResult {
  return extractCC(text, wantedFields);
}

function extractPassport(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const mrzMatch = text.match(/^P<[A-Z]{3}[A-Z<]+/m);
  if (mrzMatch) {
    const line1 = mrzMatch[0];
    const namesPart = line1.slice(5);
    const [surname, ...givenParts] = namesPart.split("<<");
    if (wantedFields.includes("nombre")) {
      const surnameClean = surname.replace(/</g, " ").trim();
      const givenClean = (givenParts.join(" ") ?? "").replace(/</g, " ").trim();
      const full = `${givenClean} ${surnameClean}`.trim();
      if (full.length > 3) result.nombre = full;
    }
    if (wantedFields.includes("numero")) {
      const lines = text.split("\n");
      const idx = lines.findIndex((l) => l.startsWith("P<"));
      const line2 = lines[idx + 1] ?? "";
      const num = line2.match(/^[A-Z0-9]{6,9}/);
      if (num) result.numero = num[0];
    }
  } else {
    const generic = extractCC(text, wantedFields);
    Object.assign(result, generic.fields);
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function pickBestDate(text: string): string | null {
  const matches = [...text.matchAll(
    /\b(\d{1,2})[/\-\s](\d{1,2})[/\-\s](\d{2,4})\b|\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b/g,
  )];
  for (const m of matches) {
    const year = m[3] ? parseInt(m[3].length === 2 ? `19${m[3]}` : m[3], 10) : parseInt(m[4], 10);
    if (year >= 1900 && year <= 2026) return m[0];
  }
  return matches[0]?.[0] ?? null;
}

export function extractByType(
  text: string,
  wantedFields: string[],
  docType: DocumentType,
): Record<string, string> {
  switch (docType) {
    case "cc": return extractCC(text, wantedFields).fields;
    case "ce": return extractCE(text, wantedFields).fields;
    case "ti": return extractTI(text, wantedFields).fields;
    case "passport": return extractPassport(text, wantedFields).fields;
    case "auto":
    default: {
      const results = [
        extractCC(text, wantedFields),
        extractPassport(text, wantedFields),
        extractCE(text, wantedFields),
        extractTI(text, wantedFields),
      ];
      results.sort((a, b) => b.matchCount - a.matchCount);
      return results[0].fields;
    }
  }
}

// ─── Validación post-OCR (no bloqueante) ────────────────────────────────────
export function validatePostOcr(data: Record<string, string>): Record<string, boolean> {
  const suspicious: Record<string, boolean> = {};
  if (data.numero && !/^[A-Z0-9]{6,12}$/.test(data.numero)) suspicious.numero = true;
  if (data.nombre && (data.nombre.length < 5 || !/\s/.test(data.nombre))) suspicious.nombre = true;
  if (data.fechaNacimiento) {
    const yearMatch = data.fechaNacimiento.match(/(\d{4})/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1], 10);
      if (y < 1900 || y > 2026) suspicious.fechaNacimiento = true;
    } else {
      suspicious.fechaNacimiento = true;
    }
  }
  return suspicious;
}
```

- [ ] **Step 3b: Reemplazar `IdScanner.render.tsx` con la versión que importa los helpers**

Reemplazar el contenido completo de `src/components/widgets/idscanner/IdScanner.render.tsx` con:

```tsx
import { useRef, useState, useCallback } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import {
  preprocessImage,
  extractByType,
  validatePostOcr,
  type DocumentType,
} from "./IdScanner.ocr";

type ScanStatus = "idle" | "camera" | "processing" | "done" | "error";

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre completo",
  numero: "Número de documento",
  fechaNacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
  fechaExpedicion: "Fecha de expedición",
  lugarExpedicion: "Lugar de expedición",
};

export default function IdScannerRender({ widget, onValue }: WidgetRenderProps) {
  const fields = (widget.config.fields as string[]) || ["nombre", "numero", "fechaNacimiento"];
  const allowManual = (widget.config.allowManual as boolean) ?? true;
  const docType = ((widget.config.documentType as string) || "auto") as DocumentType;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [suspicious, setSuspicious] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const openCamera = useCallback(async () => {
    setError("");
    setStatus("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
      setStatus("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  async function runOcr(canvas: HTMLCanvasElement) {
    setStatus("processing");
    setProgress(0);
    try {
      // Preprocesar antes de OCR (fallback seguro si peta).
      let processed: HTMLCanvasElement = canvas;
      try {
        processed = preprocessImage(canvas);
      } catch {
        // Preprocesamiento no crítico; caer a la imagen original.
      }

      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(processed, "spa", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
        // @ts-expect-error tesseract.js no expone tipo para pageseg_mode
        tessedit_pageseg_mode: "6",
      });
      const data = extractByType(result.data.text, fields, docType);
      const flags = validatePostOcr(data);
      setExtracted(data);
      setSuspicious(flags);
      setStatus("done");
      onValue?.(data);
    } catch {
      setError("Error al procesar la imagen. Intenta de nuevo.");
      setStatus("error");
    }
  }

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    await runOcr(canvas);
  }, [fields, onValue, stopCamera, docType]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Cargar imagen a canvas para poder preprocesar.
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      await runOcr(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No se pudo leer la imagen.");
      setStatus("error");
    };
    img.src = url;
  }, [fields, onValue, docType]);

  const reset = () => {
    setStatus("idle");
    setExtracted({});
    setSuspicious({});
    setError("");
    setProgress(0);
  };

  const btnStyle = (color: string, bg: string) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", borderRadius: 6, border: "none",
    fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", background: bg, color,
  });

  const hasData = Object.keys(extracted).some((k) => extracted[k]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        type="hidden"
        name={widget.id}
        value={hasData ? JSON.stringify(extracted) : ""}
        required={widget.required}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>🪪</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{widget.label}</p>
          {widget.required && <span style={{ fontSize: 12, color: "#ef4444" }}>* Obligatorio</span>}
        </div>
      </div>

      {status === "idle" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={btnStyle("#fff", "#00c2a8")} onClick={openCamera}>📷 Usar cámara</button>
          <label style={{ ...btnStyle("#00a690", "#e6faf7"), cursor: "pointer" }}>
            🖼️ Subir imagen
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {status === "camera" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: "80%", height: "60%", border: "2.5px solid #00c2a8", borderRadius: 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }} />
              <p style={{ color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 20 }}>
                Centra tu cédula dentro del recuadro
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" style={{ ...btnStyle("#fff", "#ef4444"), padding: "12px 28px", borderRadius: 50 }} onClick={capture}>⬤ Capturar</button>
            <button type="button" style={btnStyle("#6b7280", "#f3f4f6")} onClick={() => { stopCamera(); setStatus("idle"); }}>Cancelar</button>
          </div>
        </div>
      )}

      {status === "processing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 24, background: "#f9fafb", borderRadius: 10, textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00c2a8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <p style={{ fontSize: 14, color: "#6b7280" }}>Analizando documento… {progress}%</p>
          <div style={{ width: "100%", maxWidth: 240, height: 6, background: "#e2e8f0", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#00c2a8", borderRadius: 20, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#d1fae5", padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, color: "#065f46" }}>
            <span>✅ Datos extraídos</span>
            <button type="button" style={{ ...btnStyle("#6b7280", "transparent"), padding: "4px 10px", fontSize: 12 }} onClick={reset}>Reintentar</button>
          </div>
          {fields.map((key) => {
            const isSuspicious = suspicious[key] === true;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                  {FIELD_LABELS[key] ?? key}
                  {isSuspicious && (
                    <span title="Verifica este dato" style={{ marginLeft: 6, color: "#d97706" }}>⚠️</span>
                  )}
                </label>
                <input
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1.5px solid ${isSuspicious ? "#fde68a" : "#e2e8f0"}`,
                    borderRadius: 6,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                    background: isSuspicious ? "#fffbeb" : "#fff",
                  }}
                  value={extracted[key] || ""}
                  readOnly={!allowManual}
                  placeholder={`${FIELD_LABELS[key] ?? key} no detectado`}
                  onChange={(e) => {
                    const updated = { ...extracted, [key]: e.target.value };
                    setExtracted(updated);
                    // Re-evaluar sospecha para este campo tras la edición.
                    setSuspicious(validatePostOcr(updated));
                    onValue?.(updated);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, color: "#991b1b" }}>
          <p style={{ marginBottom: 8 }}>⚠️ {error}</p>
          <button type="button" style={btnStyle("#6b7280", "#f3f4f6")} onClick={reset}>Intentar de nuevo</button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check y build**

Desde `c:\proyectos\Soulmedical`:

```powershell
npx tsc --noEmit
npm run build
```

Expected: ambos con exit 0.

- [ ] **Step 5: Verificación manual E2E**

1. En el builder, arrastrar un widget "Cédula". Dejar todo por default (Tipo de documento = "Detectar automáticamente").
2. Publicar y abrir el formulario.
3. **Escenario A — Subir imagen**: subir una foto de cédula colombiana → verificar que extrae número y nombre. Comparar con el comportamiento anterior si es posible.
4. **Escenario B — Cámara**: usar cámara con una cédula real → capturar → verificar mejor precisión.
5. Volver al builder, cambiar el tipo a "Cédula de Ciudadanía (Colombia)" → probar de nuevo con la misma imagen → verificar que también funciona.
6. **Campo sospechoso**: si algún campo sale con formato raro (ej. fecha con año 1899), verificar que sale marcado en amarillo con ⚠️.

- [ ] **Step 6: Commit**

```bash
git add src/components/widgets/idscanner/IdScannerWidget.ts src/components/widgets/idscanner/IdScanner.properties.tsx src/components/widgets/idscanner/IdScanner.render.tsx src/components/widgets/idscanner/IdScanner.ocr.ts
git commit -m "feat(widget-cedula): preprocesamiento imagen + PSM 6 + regex por tipo de documento"
```

---

## Notes for the reviewer

- **YAGNI aplicado**: no agregar refactors ni "mejoras adyacentes". El constraint explícito de Sara es "sin desconfigurar algo más".
- **Backward-compat**: TODAS las nuevas keys de `defaultConfig` tienen defaults que reproducen el comportamiento anterior. Un formulario existente que no toque los nuevos controles debe seguir funcionando IDÉNTICO.
- **Tests**: Task 2 tiene tests unitarios reales del interpolador PDF. Tasks 1, 3 y 4 son puramente UI de widgets — la validación E2E manual es aceptable (patrón usado en el resto del proyecto para widgets del builder).
- **Type strictness**: Task 3 usa `@ts-expect-error` en Tesseract.js para `tessedit_pageseg_mode` — es la práctica ya usada en el archivo original. Task 4 mantiene el mismo patrón.
- **Cross-task independence**: cualquiera de las 4 tasks puede ejecutarse antes que otra sin problemas — no comparten código ni dependencias.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-03-widget-adjustments.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — dispatcho un implementer fresh por task, revisor entre tasks, iteración rápida.

**2. Inline Execution** — ejecuto tasks en esta sesión con checkpoints.
