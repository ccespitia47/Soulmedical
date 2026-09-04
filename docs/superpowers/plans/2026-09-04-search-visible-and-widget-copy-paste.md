# Search visible + Copy/Paste widgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 2 ajustes acotados en el builder: (1) Widget Search muestra 50 registros al abrir el modal; (2) copiar/pegar y duplicar widgets (mismo form o entre forms) con opción de traer reglas asociadas.

**Architecture:** 2 tasks independientes. Task 1 toca modal + 5 source adapters (frontend) y 1 service (backend). Task 2 introduce helpers puros en `src/lib/widgetClone.ts`, 2 componentes nuevos de menú, y modificaciones al store + BuilderCanvas + BuilderLayout.

**Tech Stack:** React 19 + TypeScript estricto + Zustand + Tailwind (frontend); NestJS 11 + Mongoose (backend).

**Spec:** `docs/superpowers/specs/2026-09-04-search-visible-and-widget-copy-paste-design.md`

## Global Constraints

- TypeScript estricto — no `any`, no `@ts-ignore` (usar `@ts-expect-error` con razón si es estrictamente necesario).
- Componentes < 300 líneas (regla del proyecto).
- Backward-compat: usuarios que no toquen el nuevo botón "Duplicar/⋮" ni la opción "Pegar" ven el builder **idéntico** al de hoy. Widget Search sigue funcionando para el flujo con escritura (q no vacío).
- No romper submissions ni el schema de forms/rules.
- Los tipos `WidgetInstance`, `FormRule`, `RuleCondition` NO cambian de shape.
- No agregar dependencias npm nuevas.
- Mensajes de UI en español.
- Commits atómicos: 1 commit por task.

---

## File Structure

**Task 1 (Search visible — frontend + backend):**
- Modify: `src/components/widgets/search/ResultsModal.tsx`
- Modify: `src/components/widgets/search/sources/formSubmissions.ts`
- Modify: `src/components/widgets/search/sources/googleSheets.ts`
- Modify: `src/components/widgets/search/sources/excelWeb.ts`
- Modify: `src/components/widgets/search/sources/sql.ts`
- Modify: `src/components/widgets/search/sources/group.ts`
- Modify: `backend/src/submissions/submissions.service.ts`

**Task 2 (Copy/Paste widgets — frontend):**
- Create: `src/lib/widgetClone.ts`
- Create: `src/components/builder/WidgetActionMenu.tsx`
- Create: `src/components/builder/PasteMenu.tsx`
- Modify: `src/store/useBuilderStore.ts`
- Modify: `src/components/builder/BuilderCanvas.tsx`
- Modify: `src/components/builder/BuilderLayout.tsx`

---

## Task 1: Widget Search — Mostrar 50 registros al abrir

**Files:**
- Modify: `src/components/widgets/search/ResultsModal.tsx`
- Modify: `src/components/widgets/search/sources/formSubmissions.ts`
- Modify: `src/components/widgets/search/sources/googleSheets.ts`
- Modify: `src/components/widgets/search/sources/excelWeb.ts`
- Modify: `src/components/widgets/search/sources/sql.ts`
- Modify: `src/components/widgets/search/sources/group.ts`
- Modify: `backend/src/submissions/submissions.service.ts`

**Interfaces:**
- Consumes: `SearchWidgetConfig` de `src/components/widgets/search/search.types.ts`; endpoint backend `GET /api/forms/:formId/submissions/search` con param opcional `limit`.
- Produces: `onSearch("")` en el modal devuelve los primeros 50 registros del source (sin filtro). Comportamiento con `q` no vacío queda idéntico.

### Sub-task 1.1 — Backend: permitir q vacío con límite

- [ ] **Step 1: Modificar `searchSubmissions` en el service para aceptar q vacío**

Editar `backend/src/submissions/submissions.service.ts`. Localizar el método `async searchSubmissions(formId, q, fieldIds, limit = 20)` (línea ~336). Reemplazar el bloque:

```ts
    const query = q.trim();
    if (!query) return { results: [] };

    const cappedLimit = Math.min(50, Math.max(1, limit || 20));
    // Escapa caracteres especiales de regex para que el input del usuario se
    // trate como texto literal, no como patrón (regex injection / ReDoS).
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (fieldIds.length > 0) {
```

Por:

```ts
    const query = q.trim();
    const cappedLimit = Math.min(50, Math.max(1, limit || 20));

    // Con q vacío: devolver los últimos N sin filtrar. Sirve como preview
    // inicial del modal del widget Search — el usuario ve datos listos para
    // seleccionar sin tener que escribir.
    if (!query) {
      const submissions = await this.submissionModel
        .find({ formId })
        .sort({ submittedAt: -1 })
        .limit(cappedLimit)
        .lean();
      return {
        results: submissions.map((s) => (s.data ?? {}) as Record<string, unknown>),
      };
    }

    // Escapa caracteres especiales de regex para que el input del usuario se
    // trate como texto literal, no como patrón (regex injection / ReDoS).
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (fieldIds.length > 0) {
```

- [ ] **Step 2: Verificar tests backend existentes siguen pasando**

Desde `c:\proyectos\Soulmedical\backend`:

```powershell
npx jest src/submissions
```

Expected: TODOS los tests pasan. Si algún test antes asertaba `results: []` con q="", ese test cambió de contrato — actualizarlo para asertar `results.length <= limit`. Si no hay tests que fallen, seguir.

### Sub-task 1.2 — Frontend: sources permiten q vacío

- [ ] **Step 3: `formSubmissions.ts` — permitir q="" y pasar limit=50**

Editar `src/components/widgets/search/sources/formSubmissions.ts`. Reemplazar la función completa `searchFormSubmissions` con:

```ts
export async function searchFormSubmissions(
  config: SearchWidgetConfig,
  q: string,
  share?: ShareLookup,
): Promise<Row[]> {
  // Nota: ANTES bloqueábamos q vacío con `if (!q.trim()) return [];`.
  // Ahora q vacío es válido — devuelve los primeros N sin filtrar
  // (preview inicial del modal).

  // Página pública del enlace compartible: no hay sesión, así que usamos el
  // endpoint público ligado al token de la tarea (el backend resuelve el
  // widget por id y solo busca en el sourceFormId configurado).
  if (share) {
    const res = await fetch(`${API_URL}/api/tasks/share/${share.token}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetId: share.widgetId, q }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? data.data ?? [];
  }

  // Flujo autenticado normal.
  if (!config.sourceFormId) return [];
  const params = new URLSearchParams({
    q,
    fields: (config.searchableFields ?? []).join(","),
    limit: q.trim() ? "20" : "50",
  });
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${API_URL}/api/forms/${config.sourceFormId}/submissions/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data.data ?? [];
}
```

- [ ] **Step 4: `googleSheets.ts` — permitir q="" y devolver primeros 50**

Editar `src/components/widgets/search/sources/googleSheets.ts`. Localizar la función `searchGoogleSheets` (línea ~97). Reemplazar el bloque completo:

```ts
export async function searchGoogleSheets(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.sheetsUrl || !q.trim()) return [];
  const parsed = parseSheetsUrl(config.sheetsUrl);
  if (!parsed) return [];
  // Prioridad: gid explícito de la config (nuevo), gid en la URL, o hoja default.
  const gid = config.sheetsGid ?? parsed.gid;
  // El endpoint /pub?output=csv NO acepta el parámetro range — devuelve el
  // sheet completo; filtramos en memoria abajo.
  const range = parsed.published ? undefined : (config.sheetsRange || undefined);
  const csvUrl = buildCsvUrl(parsed.id, gid, parsed.published, range);
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCsv(text).map((r) => r.map((c) => c.trim()));
  const headers = rows[0] ?? [];
  const searchCol = config.sheetsSearchCol ?? "";
  // findIndex devuelve -1 (no undefined) cuando no encuentra match, así que
  // `?? 0` nunca aplicaba — usamos Math.max(0, ...) para caer a la primera
  // columna solo cuando realmente no hay match.
  const colIdx = Math.max(0, headers.findIndex((h) => h.toLowerCase() === searchCol.toLowerCase()));
  return rows.slice(1)
    .filter((r) => r[colIdx]?.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
```

Por:

```ts
export async function searchGoogleSheets(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  // Nota: ANTES bloqueábamos q vacío. Ahora q vacío devuelve los primeros
  // 50 sin filtrar (preview inicial del modal).
  if (!config.sheetsUrl) return [];
  const parsed = parseSheetsUrl(config.sheetsUrl);
  if (!parsed) return [];
  const gid = config.sheetsGid ?? parsed.gid;
  const range = parsed.published ? undefined : (config.sheetsRange || undefined);
  const csvUrl = buildCsvUrl(parsed.id, gid, parsed.published, range);
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCsv(text).map((r) => r.map((c) => c.trim()));
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  // Preview inicial: primeros 50 sin filtrar.
  if (!q.trim()) {
    return dataRows
      .slice(0, 50)
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  }

  // Búsqueda con query: filtro por columna configurada, primeros 20.
  const searchCol = config.sheetsSearchCol ?? "";
  const colIdx = Math.max(0, headers.findIndex((h) => h.toLowerCase() === searchCol.toLowerCase()));
  return dataRows
    .filter((r) => r[colIdx]?.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
```

- [ ] **Step 5: `excelWeb.ts` — permitir q="" (pasar al backend, el backend NO devolverá por ahora — deferido)**

Editar `src/components/widgets/search/sources/excelWeb.ts`. Localizar la función `searchExcelWeb` (línea ~31). Reemplazar la primera guarda:

```ts
  if (!config.excelUrl || !q.trim() || !config.excelSearchCol) return [];
```

Por:

```ts
  // Con q vacío devolvemos vacío por ahora — el backend /excel/search
  // no soporta preview sin query y agregarlo requiere modificar el flujo
  // Graph API. Deferido; el modal mostrará "sin resultados" hasta que el
  // usuario escriba (mismo UX que hoy para este source específico).
  if (!config.excelUrl || !q.trim() || !config.excelSearchCol) return [];
```

Nota: comentario claro documenta que `excel_web` es la excepción — no rompe el UX, solo no participa del preview.

- [ ] **Step 6: `sql.ts` — permitir q="" (mismo tratamiento que excelWeb: comentario + return vacío)**

Editar `src/components/widgets/search/sources/sql.ts`. Localizar la primera línea del cuerpo:

```ts
  if (!config.sqlEndpoint || !q.trim()) return [];
```

Reemplazar por:

```ts
  // Con q vacío devolvemos vacío por ahora — el endpoint SQL configurable
  // no tiene contrato definido para preview sin query. El usuario debe
  // escribir para obtener resultados (mismo UX que hoy para SQL).
  if (!config.sqlEndpoint || !q.trim()) return [];
```

- [ ] **Step 7: `group.ts` — permitir q="" y devolver primeros 50 miembros**

Editar `src/components/widgets/search/sources/group.ts`. Reemplazar el archivo completo con:

```ts
import type { SearchWidgetConfig } from "../search.types";
import { API_URL } from "./apiUrl";

type Row = Record<string, unknown>;

export async function searchGroup(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.groupId) return [];
  const token = localStorage.getItem("token") ?? "";
  // Con q vacío pedimos primeros 50 miembros como preview inicial del modal;
  // con q pega el filtro real. El endpoint /members/search maneja q="" hoy
  // devolviendo todos los miembros del grupo — un grupo típico es pequeño
  // (< 100), así que el slice(0,50) client-side cubre el caso.
  const qParam = encodeURIComponent(q);
  const res = await fetch(`${API_URL}/api/groups/${config.groupId}/members/search?q=${qParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Row[];
  return q.trim() ? data : data.slice(0, 50);
}
```

### Sub-task 1.3 — Frontend: modal muestra la lista desde el inicio

- [ ] **Step 8: Actualizar `ResultsModal.tsx` — trigger inicial + placeholder + eliminar "empieza a escribir"**

Reemplazar el contenido completo de `src/components/widgets/search/ResultsModal.tsx` con:

```tsx
import { useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;

type Props = {
  columns: { key: string; label: string }[];
  /** Cuando `columns` está vacío, usar este key como columna única.
   *  Si no se provee, se toma la primera key con valor no vacío del row. */
  fallbackKey?: string;
  initialQuery?: string;
  minChars: number;
  onSearch: (q: string) => Promise<Row[]>;
  onSelect: (row: Row) => void;
  onClose: () => void;
};

// Cantidad de registros a mostrar como preview inicial (q="").
const PREVIEW_LIMIT = 50;

/**
 * Modal auto-contenido: al abrir dispara onSearch("") para mostrar los
 * primeros PREVIEW_LIMIT registros sin filtrar. Al escribir, filtra con
 * debounce de 300ms (comportamiento previo). Auto-focus en el input al abrir.
 */
export default function ResultsModal({
  columns,
  fallbackKey,
  initialQuery = "",
  minChars,
  onSearch,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auto-focus al montar
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = query.trim();
      // 3 casos:
      // - q === ""             → preview inicial (source devuelve primeros N)
      // - q y q.length < minChars → mantener lo anterior visible (no re-buscar)
      // - q.length >= minChars → búsqueda real
      if (q !== "" && q.length < minChars) {
        // No cambia results — deja lo que había (preview o última búsqueda).
        return;
      }
      setLoading(true);
      setIsPreview(q === "");
      try { setResults(await onSearch(q)); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, minChars, onSearch]);

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fallback: si no hay columns configuradas, mostrar hasta 5 columnas con
  // las keys que tengan valor no vacío en al menos un row.
  const nonEmptyKeys = (): string[] => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of results) {
      for (const [k, v] of Object.entries(row)) {
        if (seen.has(k)) continue;
        if (v != null && String(v).trim() !== "") {
          seen.add(k);
          order.push(k);
        }
      }
    }
    return order;
  };
  const buildFallbackCols = () => {
    const keys = nonEmptyKeys();
    if (fallbackKey && keys.includes(fallbackKey)) {
      const rest = keys.filter((k) => k !== fallbackKey);
      return [fallbackKey, ...rest].slice(0, 5).map((k) => ({ key: k, label: k }));
    }
    return keys.slice(0, 5).map((k) => ({ key: k, label: k }));
  };
  const fallbackCols = buildFallbackCols();
  const displayCols =
    columns.length > 0
      ? columns
      : fallbackCols.length > 0
      ? fallbackCols
      : [{ key: "value", label: "Resultado" }];

  const q = query.trim();
  const hintText =
    q === ""
      ? `Mostrando primeros ${PREVIEW_LIMIT} — escribe para filtrar`
      : q.length < minChars
      ? `Escribe al menos ${minChars} caracter${minChars === 1 ? "" : "es"} para buscar`
      : `${results.length} resultado${results.length === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-[720px] flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con input de búsqueda */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-bold text-gray-900">🔍 Buscar</div>
            <button
              onClick={onClose}
              className="h-8 w-8 cursor-pointer rounded-lg border-none bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Escribe para filtrar..."
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 pr-10 text-[14px] outline-none focus:border-[#00c2a8]"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">⏳</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-400">{hintText}</div>
        </div>

        {/* Tabla de resultados (preview inicial o búsqueda) */}
        <div className="flex-1 overflow-auto">
          {loading && results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">⏳</div>
                <p className="text-sm">Cargando…</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">🔍</div>
                <p>{isPreview ? "Sin registros" : "No se encontraron resultados"}</p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {displayCols.map((c) => (
                    <th
                      key={c.key}
                      className="border-b border-slate-200 px-4 py-2.5 text-left text-xs font-bold uppercase text-gray-500"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr
                    key={i}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-emerald-50"
                    onClick={() => onSelect(row)}
                  >
                    {displayCols.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-sm text-gray-900">
                        {String(row[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Sub-task 1.4 — Verificación y commit

- [ ] **Step 9: Type-check y build (frontend + backend)**

Desde `c:\proyectos\Soulmedical`:
```powershell
npx tsc --noEmit
npm run build
```

Desde `c:\proyectos\Soulmedical\backend`:
```powershell
npx tsc --noEmit
npm run build
npx jest
```

Expected: todos exit 0, todos los jest tests pasan.

- [ ] **Step 10: Commit**

```bash
git add src/components/widgets/search/ResultsModal.tsx src/components/widgets/search/sources/formSubmissions.ts src/components/widgets/search/sources/googleSheets.ts src/components/widgets/search/sources/excelWeb.ts src/components/widgets/search/sources/sql.ts src/components/widgets/search/sources/group.ts backend/src/submissions/submissions.service.ts
git commit -m "feat(widget-search): mostrar 50 registros al abrir modal (preview sin filtro)"
```

---

## Task 2: Copy/Paste + Duplicar widgets

**Files:**
- Create: `src/lib/widgetClone.ts`
- Create: `src/components/builder/WidgetActionMenu.tsx`
- Create: `src/components/builder/PasteMenu.tsx`
- Modify: `src/store/useBuilderStore.ts`
- Modify: `src/components/builder/BuilderCanvas.tsx`
- Modify: `src/components/builder/BuilderLayout.tsx`

**Interfaces:**
- Consumes: `WidgetInstance`, `FormRule` de `src/types/widget.types.ts`; `randomUUID` de `src/utils/uuid.ts`; `useBuilderStore` state.
- Produces:
  - `src/lib/widgetClone.ts` — 3 helpers puros: `cloneWidgetWithNewId(widget) → { widget, newId }`, `cloneRulesForNewWidget(rules, oldId, newId) → FormRule[]`, `filterViableRulesForForm(rules, existingWidgetIds) → { viable, discarded }`.
  - Nuevo hook `useClipboardWidget()` (dentro de `widgetClone.ts`) que lee/observa `localStorage.getItem("soulforms-widget-clipboard")` con listener a `storage` event.
  - `useBuilderStore.duplicateWidget(id, { withRules }) → { newId, oldId }` inserta clon después del original y devuelve los ids.
  - `useBuilderStore.insertWidget(widget)` inserta un widget al final (usado por Paste).
  - `WidgetActionMenu` — dropdown con 4 opciones al click en `⋮` del widget.
  - `PasteMenu` (integrado inline en `BuilderLayout`) — dropdown al click en botón "Pegar".

### Sub-task 2.1 — Helpers puros

- [ ] **Step 1: Crear `src/lib/widgetClone.ts`**

Crear el archivo con el contenido:

```ts
import { useEffect, useState } from "react";
import { randomUUID } from "../utils/uuid";
import type { WidgetInstance, FormRule } from "../types/widget.types";

const CLIPBOARD_KEY = "soulforms-widget-clipboard";

export type WidgetClipboard = {
  widget: WidgetInstance;
  rules: FormRule[];        // vacío [] si se copió "solo widget"
  sourceFormId: string | null;
  copiedAt: number;
};

/**
 * Clona un widget con un nuevo id. Hace deep-clone del `config` para
 * evitar mutaciones cruzadas entre el widget original y el clon.
 * El label recibe sufijo " (copia)" para que el admin distinga los dos.
 */
export function cloneWidgetWithNewId(widget: WidgetInstance): {
  widget: WidgetInstance;
  newId: string;
} {
  const newId = randomUUID();
  const cloned: WidgetInstance = {
    ...widget,
    id: newId,
    config: JSON.parse(JSON.stringify(widget.config)) as Record<string, unknown>,
    label: `${widget.label} (copia)`,
  };
  return { widget: cloned, newId };
}

/**
 * Devuelve las reglas donde `oldId` aparece (como condition source o como
 * target), con oldId reemplazado por newId. La regla original NO se muta;
 * se devuelven reglas NUEVAS (id fresco + name con sufijo) listas para
 * agregar al form.
 */
export function cloneRulesForNewWidget(
  rules: FormRule[],
  oldId: string,
  newId: string,
): FormRule[] {
  const cloned: FormRule[] = [];
  for (const rule of rules) {
    const involvesOld =
      rule.conditions.some((c) => c.widgetId === oldId) ||
      rule.targetWidgetIds.includes(oldId);
    if (!involvesOld) continue;
    cloned.push({
      ...rule,
      id: randomUUID(),
      name: `${rule.name} (copia)`,
      conditions: rule.conditions.map((c) =>
        c.widgetId === oldId ? { ...c, widgetId: newId } : { ...c },
      ),
      targetWidgetIds: rule.targetWidgetIds.map((id) => (id === oldId ? newId : id)),
    });
  }
  return cloned;
}

/**
 * Filtra reglas cuyos widgetIds (en conditions o targetWidgetIds) referencien
 * widgets que NO existen en el form destino. Se usa al pegar entre forms.
 * Devuelve las reglas viables + el conteo de descartadas para poder mostrar
 * un toast informativo al usuario.
 */
export function filterViableRulesForForm(
  rules: FormRule[],
  existingWidgetIds: Set<string>,
): { viable: FormRule[]; discarded: number } {
  const viable: FormRule[] = [];
  let discarded = 0;
  for (const rule of rules) {
    const allConditionsValid = rule.conditions.every((c) =>
      existingWidgetIds.has(c.widgetId),
    );
    const allTargetsValid = rule.targetWidgetIds.every((id) =>
      existingWidgetIds.has(id),
    );
    if (allConditionsValid && allTargetsValid) viable.push(rule);
    else discarded += 1;
  }
  return { viable, discarded };
}

// ─── Clipboard (localStorage) ────────────────────────────────────────────────

export function writeClipboard(data: WidgetClipboard): void {
  try {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
    // Disparamos manualmente un storage event dentro del mismo tab —
    // el listener nativo `storage` solo se dispara en OTROS tabs.
    window.dispatchEvent(new Event("soulforms-clipboard-changed"));
  } catch (err) {
    console.error("[widgetClone] No se pudo escribir clipboard:", err);
  }
}

export function readClipboard(): WidgetClipboard | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Validación defensiva del shape — clipboard corrupto se ignora.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("widget" in parsed) ||
      !("rules" in parsed)
    ) {
      return null;
    }
    return parsed as WidgetClipboard;
  } catch {
    return null;
  }
}

/**
 * Hook que devuelve el contenido actual del clipboard, y se re-renderiza
 * cuando cambia (misma pestaña o otra pestaña). Devuelve null si el
 * clipboard está vacío o corrupto.
 */
export function useClipboardWidget(): WidgetClipboard | null {
  const [state, setState] = useState<WidgetClipboard | null>(() => readClipboard());
  useEffect(() => {
    const refresh = () => setState(readClipboard());
    // 'storage' event nativo solo se dispara en otros tabs; complementamos
    // con nuestro evento custom para el mismo tab (ver writeClipboard).
    window.addEventListener("storage", refresh);
    window.addEventListener("soulforms-clipboard-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("soulforms-clipboard-changed", refresh);
    };
  }, []);
  return state;
}
```

### Sub-task 2.2 — Store: nuevos métodos

- [ ] **Step 2: Extender `useBuilderStore.ts` con `duplicateWidget` e `insertWidget`**

Editar `src/store/useBuilderStore.ts`.

Localizar el `import` en línea 6:
```ts
import { randomUUID } from "../utils/uuid";
```

Agregar debajo:
```ts
import { cloneWidgetWithNewId } from "../lib/widgetClone";
```

Localizar la interfaz `BuilderState` (líneas 8-22) y agregar 2 métodos al final (antes del cierre `}`):
```ts
  duplicateWidget: (id: string) => { newId: string; oldId: string } | null;
  insertWidget: (widget: WidgetInstance) => void;
```

Luego, en el bloque de la implementación del store (después del método `moveWidget`, línea ~72-75), agregar antes del cierre `})`:
```ts

      duplicateWidget: (id) => {
        const state = get();
        const idx = state.widgets.findIndex((w) => w.id === id);
        if (idx === -1) return null;
        const source = state.widgets[idx];
        const { widget: cloned, newId } = cloneWidgetWithNewId(source);
        const next = [...state.widgets];
        next.splice(idx + 1, 0, cloned);
        set({ widgets: next, selectedWidgetId: newId });
        return { newId, oldId: id };
      },

      insertWidget: (widget) =>
        set((state) => ({
          widgets: [...state.widgets, widget],
          selectedWidgetId: widget.id,
        })),
```

Nota: `duplicateWidget` usa `get()` de zustand — asegurar que el signature del `create` incluye `get`. Editar la firma del create desde:
```ts
export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
```
Por:
```ts
export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
```

### Sub-task 2.3 — Componente `WidgetActionMenu`

- [ ] **Step 3: Crear `src/components/builder/WidgetActionMenu.tsx`**

Crear el archivo con el contenido:

```tsx
import { useEffect, useRef } from "react";

type Props = {
  onDuplicate: () => void;
  onDuplicateWithRules: () => void;
  onCopy: () => void;
  onCopyWithRules: () => void;
  onClose: () => void;
};

/**
 * Dropdown que aparece al hacer click en el botón ⋮ de un widget del canvas.
 * 4 opciones: Duplicar (solo widget) / Duplicar con reglas / Copiar / Copiar con reglas.
 * Cierra al click fuera o al presionar ESC.
 */
export default function WidgetActionMenu({
  onDuplicate,
  onDuplicateWithRules,
  onCopy,
  onCopyWithRules,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // setTimeout para que el click que abrió el menú no lo cierre inmediatamente.
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#111827",
    textAlign: "left",
    fontFamily: "inherit",
  };

  return (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 32,
        right: 8,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 220,
        zIndex: 20,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onDuplicate(); onClose(); }}
      >
        <span>🗂️</span>
        <span>Duplicar</span>
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onDuplicateWithRules(); onClose(); }}
      >
        <span>🗂️</span>
        <span>Duplicar con reglas</span>
      </button>
      <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onCopy(); onClose(); }}
      >
        <span>📋</span>
        <span>Copiar</span>
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onCopyWithRules(); onClose(); }}
      >
        <span>📋</span>
        <span>Copiar con reglas</span>
      </button>
    </div>
  );
}
```

### Sub-task 2.4 — BuilderCanvas: botón ⋮ y integración de menú

- [ ] **Step 4: Modificar `BuilderCanvas.tsx` — agregar botón ⋮ y menú**

Editar `src/components/builder/BuilderCanvas.tsx`.

Actualizar los imports (líneas 15-20). Reemplazar:
```tsx
import { useBuilderStore } from "../../store/useBuilderStore";
import { widgetRegistry } from "../widgets/registry";
import type { WidgetInstance } from "../../types/widget.types";
import Icon from "../common/Icon";
```

Por:
```tsx
import { useState } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";
import { widgetRegistry } from "../widgets/registry";
import type { WidgetInstance } from "../../types/widget.types";
import Icon from "../common/Icon";
import WidgetActionMenu from "./WidgetActionMenu";
import {
  cloneRulesForNewWidget,
  writeClipboard,
} from "../../lib/widgetClone";
```

Reemplazar la función `SortableItem` completa por:

```tsx
function SortableItem({ widget, folderId, formId }: {
  widget: WidgetInstance;
  folderId?: string;
  formId?: string;
}) {
  const { removeWidget, selectWidget, selectedWidgetId, duplicateWidget } = useBuilderStore();
  const { folders, saveFormRules } = useFolderStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelected = widget.id === selectedWidgetId;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    background: "#ffffff",
    border: isSelected ? "2px solid #00c2a8" : "1.5px solid #e2e8f0",
    borderRadius: 10,
    marginBottom: 10,
    boxShadow: isSelected
      ? "0 0 0 3px rgba(0,194,168,0.15)"
      : "0 1px 3px rgba(0,0,0,0.08)",
    cursor: "pointer",
    overflow: "visible",
  };

  const Preview = widgetRegistry[widget.type]?.preview;

  // Helpers para leer las rules del form actual desde el folder store.
  const currentRules = (() => {
    if (!folderId || !formId) return [];
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    return form?.rules ?? [];
  })();

  const handleDuplicate = (withRules: boolean) => {
    const result = duplicateWidget(widget.id);
    if (!result) return;
    if (withRules && folderId && formId) {
      const clones = cloneRulesForNewWidget(currentRules, result.oldId, result.newId);
      if (clones.length > 0) {
        void saveFormRules(folderId, formId, [...currentRules, ...clones]);
      }
    }
  };

  const handleCopy = (withRules: boolean) => {
    // Al copiar, si "con reglas": guardamos las rules donde el widget original
    // aparezca, SIN remapear (se guardan con el id original del widget).
    // Al pegar en otro form, el remapping y filtrado ocurre allá.
    const rulesForClipboard = withRules
      ? currentRules.filter(
          (r) =>
            r.conditions.some((c) => c.widgetId === widget.id) ||
            r.targetWidgetIds.includes(widget.id),
        )
      : [];
    writeClipboard({
      widget,
      rules: rulesForClipboard,
      sourceFormId: formId ?? null,
      copiedAt: Date.now(),
    });
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => selectWidget(widget.id)}>
      {/* Handle de arrastre */}
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          cursor: "grab",
          fontSize: 11,
          color: "#9ca3af",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <span>⠿</span>
        <span>Arrastrar para reordenar</span>
      </div>

      {/* Preview del widget */}
      {Preview ? (
        <Preview widget={widget} />
      ) : (
        <p style={{ padding: 12, fontSize: 14, color: "#9ca3af" }}>Sin preview</p>
      )}

      {/* Botón ⋮ (menú de acciones) */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        style={{
          position: "absolute", top: 4, right: 34,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, color: "#9ca3af", width: 24, height: 24,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = "#0f172a"; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
        aria-label="Acciones del widget"
        title="Duplicar / Copiar"
      >
        ⋮
      </button>

      {/* Botón eliminar */}
      <button
        onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
        style={{
          position: "absolute", top: 4, right: 8,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: "#9ca3af", width: 24, height: 24,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseOver={(e) => { (e.target as HTMLElement).style.color = "#ef4444"; }}
        onMouseOut={(e) => { (e.target as HTMLElement).style.color = "#9ca3af"; }}
      >
        ✕
      </button>

      {menuOpen && (
        <WidgetActionMenu
          onDuplicate={() => handleDuplicate(false)}
          onDuplicateWithRules={() => handleDuplicate(true)}
          onCopy={() => handleCopy(false)}
          onCopyWithRules={() => handleCopy(true)}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
```

Además, actualizar `BuilderCanvas` para pasar `folderId` y `formId` a cada `SortableItem`. Reemplazar la firma del componente y el uso:

Reemplazar:
```tsx
export default function BuilderCanvas() {
  const { widgets, moveWidget, clearSelection } = useBuilderStore();
```

Por:
```tsx
export default function BuilderCanvas({ folderId, formId }: {
  folderId?: string;
  formId?: string;
}) {
  const { widgets, moveWidget, clearSelection } = useBuilderStore();
```

Y en el render (línea ~151), reemplazar:
```tsx
              <SortableItem key={widget.id} widget={widget} />
```

Por:
```tsx
              <SortableItem key={widget.id} widget={widget} folderId={folderId} formId={formId} />
```

### Sub-task 2.5 — PasteMenu componente + BuilderLayout integración

- [ ] **Step 5a: Crear `src/components/builder/PasteMenu.tsx`**

Crear el archivo con el contenido:

```tsx
import { useEffect, useRef } from "react";
import type { WidgetClipboard } from "../../lib/widgetClone";

type Props = {
  clipboard: WidgetClipboard;
  onPaste: (withRules: boolean) => void;
  onClose: () => void;
};

/**
 * Dropdown que aparece al click en el botón "Pegar" del top-bar del builder.
 * 2 opciones: Pegar (solo widget) / Pegar con reglas (N). Cierra al click
 * fuera o ESC.
 */
export default function PasteMenu({ clipboard, onPaste, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // setTimeout para que el click que abrió el menú no lo cierre inmediatamente.
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#111827",
    textAlign: "left",
    fontFamily: "inherit",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: 40,
        left: 0,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 220,
        zIndex: 30,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => onPaste(false)}
      >
        📋 Pegar (solo widget)
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => onPaste(true)}
      >
        📋 Pegar con reglas ({clipboard.rules.length})
      </button>
    </div>
  );
}
```

- [ ] **Step 5b: Modificar `BuilderLayout.tsx` — agregar botón Pegar en top-bar + pasar props**

Editar `src/components/builder/BuilderLayout.tsx`.

Actualizar los imports (líneas 1-14). Agregar al final del bloque de imports:
```tsx
import {
  cloneWidgetWithNewId,
  cloneRulesForNewWidget,
  filterViableRulesForForm,
  useClipboardWidget,
} from "../../lib/widgetClone";
import PasteMenu from "./PasteMenu";
```

Dentro del componente `BuilderLayout`, después de la línea `const [successModal, setSuccessModal] = useState<...>(null);` (línea ~157), agregar:

```tsx
  const clipboard = useClipboardWidget();
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const { insertWidget } = useBuilderStore();

  const handlePaste = (withRules: boolean) => {
    if (!clipboard) return;
    const { widget: cloned, newId } = cloneWidgetWithNewId(clipboard.widget);
    insertWidget(cloned);
    let toastMsg = `Widget "${cloned.label}" pegado`;
    if (withRules && clipboard.rules.length > 0 && folderId && formId) {
      // Remapear las rules del clipboard al nuevo id del widget pegado.
      const remapped = cloneRulesForNewWidget(clipboard.rules, clipboard.widget.id, newId);
      // Filtrar rules que referencien widgets que NO existen en el form destino.
      const existingIds = new Set([...widgets.map((w) => w.id), newId]);
      const { viable, discarded } = filterViableRulesForForm(remapped, existingIds);
      if (viable.length > 0) {
        void saveFormRules(folderId, formId, [...rules, ...viable]);
      }
      const parts: string[] = [];
      if (viable.length > 0) parts.push(`${viable.length} regla${viable.length === 1 ? "" : "s"} agregada${viable.length === 1 ? "" : "s"}`);
      if (discarded > 0) parts.push(`${discarded} descartada${discarded === 1 ? "" : "s"} (referencian widgets que no existen aquí)`);
      if (parts.length > 0) toastMsg = `${toastMsg}. ${parts.join(", ")}`;
    }
    setPasteToast(toastMsg);
    setPasteMenuOpen(false);
    setTimeout(() => setPasteToast(null), 4000);
  };
```

Localizar el bloque donde se define el botón "Preview" (línea ~223-227). Justo ANTES del botón Preview, agregar el nuevo botón "Pegar":

```tsx
          {clipboard && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setPasteMenuOpen((v) => !v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0891b2", fontFamily: "inherit", transition: "all 0.15s ease" }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "#00c2a8"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                title={`Pegar "${clipboard.widget.label}"`}
              >
                📋 Pegar "{clipboard.widget.label.length > 20 ? `${clipboard.widget.label.slice(0, 20)}…` : clipboard.widget.label}"
              </button>
              {pasteMenuOpen && (
                <PasteMenu
                  clipboard={clipboard}
                  onPaste={handlePaste}
                  onClose={() => setPasteMenuOpen(false)}
                />
              )}
            </div>
          )}
```

Localizar la línea del `<BuilderCanvas />` (línea ~266):
```tsx
        <main style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}><BuilderCanvas /></main>
```

Reemplazarla por:
```tsx
        <main style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f0f4f8" }}><BuilderCanvas folderId={folderId} formId={formId} /></main>
```

Y agregar el toast al final del componente, justo antes del último `</div>` (después de `<style>...</style>`, línea ~279):
```tsx
      {pasteToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 500,
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          {pasteToast}
        </div>
      )}
```

### Sub-task 2.6 — Verificación y commit

- [ ] **Step 6: Type-check y build**

Desde `c:\proyectos\Soulmedical`:
```powershell
npx tsc --noEmit
npm run build
```

Expected: ambos exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/widgetClone.ts src/components/builder/WidgetActionMenu.tsx src/components/builder/PasteMenu.tsx src/store/useBuilderStore.ts src/components/builder/BuilderCanvas.tsx src/components/builder/BuilderLayout.tsx
git commit -m "feat(builder): duplicar/copiar/pegar widgets con opcion de traer reglas"
```

---

## Notes for the reviewer

- **YAGNI aplicado**: no agregar refactors adyacentes. El constraint es "sin desconfigurar algo más".
- **Backward-compat**: usuarios que no toquen los nuevos botones ⋮/Pegar ven el builder idéntico. El widget Search sigue funcionando para búsquedas con q no vacío (el flujo previo).
- **Tests**: solo el backend tiene test suite; los widgets/builder son manual-E2E-only (patrón del proyecto).
- **Sources sin preview**: `excel_web` y `sql` se documentan en el código como "no soportan preview" — devuelven vacío con q="". El modal mostrará "Sin registros" hasta que el usuario escriba.
- **Clipboard**: sobrevive close del tab (localStorage). El botón "Pegar" en top-bar reactivamente aparece/desaparece según el clipboard (useClipboardWidget escucha `storage` + evento custom `soulforms-clipboard-changed`).
- **Rules remap**: al copiar, guardamos las rules con el id original del widget. Al pegar, remapeamos al nuevo id (`cloneRulesForNewWidget`) y luego filtramos las que referencien widgets inexistentes en el form destino (`filterViableRulesForForm`).
- **Sin colisión con drag**: el botón ⋮ tiene `stopPropagation` en su click, no se activa desde el handle de drag (`⠿` bar). El menú tiene `mousedown` listener en document con setTimeout(0) para que el click que lo abre no lo cierre inmediatamente.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-04-search-visible-and-widget-copy-paste.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — dispatcho un implementer fresh por task, revisor entre tasks, iteración rápida.

**2. Inline Execution** — ejecuto tasks en esta sesión con checkpoints.
