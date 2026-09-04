# Search visible + Copy/Paste widgets — Diseño

**Fecha:** 2026-09-04
**Alcance:** 2 ajustes acotados en el builder de formularios: (1) el modal del widget Search muestra 50 registros al abrir sin necesidad de escribir; (2) copiar/pegar y duplicar widgets en el builder, con opción de traer las reglas asociadas.

## Contexto

Sara reporta 2 friction points concretos:

1. **Widget Search** — hoy el modal (`ResultsModal.tsx`) oculta los resultados hasta que el usuario escribe ≥`minChars` (default 2). Sara quiere que al abrir el modal ya vea contenido listo para seleccionar, sin tener que escribir. Screenshot compartido: modal con "Escribe al menos 2 caracteres..." + ilustración "Empieza a escribir…" — cero contenido visible.

2. **Copy/Paste widgets** — hoy en el builder solo se puede agregar un widget nuevo desde la paleta o eliminarlo. No existe forma de duplicar (mismo form) ni de copiar/pegar (entre forms). Sara quiere ambos, con opción de traer o no las reglas del formulario asociadas al widget copiado.

Constraint implícito (patrón previo de Sara): "no desconfigurar algo más" — cambios acotados a los archivos listados, sin refactors adyacentes.

## Global Constraints

- TypeScript estricto en todo el frontend.
- Componentes < 300 líneas (regla del proyecto).
- Tailwind + mobile-first + dark mode aware.
- No romper el flujo actual: usuarios que no toquen el nuevo botón "Duplicar" ni la opción "Pegar" ven el builder **idéntico** al de hoy.
- No romper submissions ni el schema de forms.
- Los tipos existentes (`WidgetInstance`, `FormRule`, `RuleCondition`) NO cambian de forma.
- No agregar dependencias npm nuevas — clipboard usa `localStorage` (o el store zustand), no la Clipboard API del OS.
- Mensajes de UI en español.

## Arquitectura

Cambios distribuidos en 2 áreas independientes:

- **Sección 1 (Search)**: modificaciones al modal + a los 5 source adapters (`sources/*.ts`) para soportar query vacía con límite fijo.
- **Sección 2 (Copy/Paste)**: nuevos helpers puros en `src/lib/widgetClone.ts`, nuevos métodos en `useBuilderStore`, nuevo componente `WidgetActionMenu` (dropdown ⋮), botón "Pegar" en `BuilderLayout` top-bar.

Ninguna sección toca: store global de folders (`useFolderStore`), servicios de API/auth, schema de Mongoose, otros widgets no listados.

---

## Sección 1 — Widget Search: mostrar 50 registros al abrir

### Objetivo
Al abrir el modal del widget Search, disparar automáticamente un search con `q=""` que devuelve los primeros **50 registros** (constante `PREVIEW_LIMIT`). El usuario ve contenido listo para seleccionar sin escribir. Al escribir, comportamiento actual (filtra con debounce 300ms). Al borrar el input, vuelve a los primeros 50.

### Archivos afectados

- **Modal:** `src/components/widgets/search/ResultsModal.tsx` — cambio del useEffect de búsqueda para disparar también en `q === ""`; placeholder actualizado; texto de "Empieza a escribir…" eliminado.
- **Sources:**
  - `src/components/widgets/search/sources/formSubmissions.ts` — agregar `limit: 50` cuando `q === ""` en la request al backend.
  - `src/components/widgets/search/sources/googleSheets.ts` — devolver `.slice(0, 50)` cuando `q === ""`.
  - `src/components/widgets/search/sources/excelWeb.ts` — mismo patrón.
  - `src/components/widgets/search/sources/sql.ts` — mismo patrón.
  - `src/components/widgets/search/sources/group.ts` — mismo patrón.
- **Backend:** `backend/src/submissions/records.controller.ts` (o donde está el endpoint que `formSubmissions.ts` invoca) — asegurar que acepta `limit` como query param y que con `q=""` respeta ese límite en vez de devolver todo.

### Data flow

```
Usuario click en "🔍 Buscar" → abre modal
    │
    ├── useEffect on mount → dispara onSearch("")
    │
    ├── source con q="" → devuelve primeros 50 registros
    │
    └── modal renderiza tabla con 50 filas seleccionables

Usuario escribe → useEffect on [query] → debounce 300ms → onSearch(query)
    │
    ├── query.length >= minChars → source ejecuta búsqueda real
    ├── query.length < minChars → mantener los 50 originales (o llamar q="")
    └── query === "" → vuelve a los primeros 50 (idéntico a apertura)

Placeholder input:
    │
    ├── q === "" → "Escribe para filtrar..."
    └── q !== "" y < minChars → "Escribe al menos N caracteres para buscar..."
```

### Detalles

- Constante `PREVIEW_LIMIT = 50` en `ResultsModal.tsx` (no configurable en esta primera pasada).
- Si un source no puede devolver 50 (por ejemplo `group` con solo 20 miembros), se muestran los que hay — no es un error.
- El mensaje bajo el input:
  - Con `q === ""`: `"Mostrando primeros N resultados — escribe para filtrar"`.
  - Con `q.length < minChars && q.length > 0`: mantener el mensaje actual `"Escribe al menos N caracteres para buscar"`.
  - Con `q.length >= minChars`: mantener el mensaje actual `"N resultados"`.
- La ilustración "Empieza a escribir…" (líneas 137-142 del modal actual) se **elimina** — ya no aplica porque el modal siempre tiene contenido o "sin resultados".
- El estado `loading` funciona igual: se muestra ⏳ mientras el source responde.

### Backend

El endpoint que `formSubmissions.ts` invoca (probablemente `/records/search` o similar) debe:
- Aceptar `q` opcional (ya lo hace).
- Aceptar `limit` opcional. Default: sin límite explícito, pero cuando `q === ""` **y** no viene limit, el cliente ya está mandando `limit=50` en la request.
- Si el endpoint hoy rechaza `q === ""` con 400, cambiar a permitirlo (devuelve los primeros N sin filtrar).

**Tarea inicial de la Task 1 del plan**: localizar el endpoint exacto (grep `q=|widgetId|source: 'form_submissions'` en backend) y confirmar que acepta el parámetro `limit`. Si no, agregarlo.

### Testing

- Manual E2E: abrir un formulario con widget Search, click en "🔍 Buscar" → verificar que ves ~50 filas de una vez sin escribir.
- Manual E2E: escribir 3 caracteres → filtra normalmente.
- Manual E2E: borrar el input → vuelve a los 50 primeros.
- Manual E2E: source `google_sheets` con hoja de 500 filas → ver solo 50, filtro funciona.
- Manual E2E: source `group` con 5 miembros → ver los 5.

---

## Sección 2 — Copy/Paste + Duplicar widgets

### Objetivo
Permitir al admin del builder:
- **Duplicar** un widget dentro del mismo form (rápido, un click).
- **Copiar** un widget al clipboard (localStorage) y **pegar** en el mismo o en otro form.
- En ambas operaciones (Duplicar y Pegar), elegir entre traer las reglas del formulario que involucran al widget original o dejarlas.

### Archivos afectados

- **Nuevo:** `src/lib/widgetClone.ts` — helpers puros para clonar widget con nuevo ID y clonar reglas.
- **Nuevo:** `src/components/builder/WidgetActionMenu.tsx` — dropdown que aparece al click en el botón `⋮` de un widget (Duplicar / Duplicar con reglas / Copiar / Copiar con reglas).
- **Nuevo:** `src/components/builder/PasteMenu.tsx` — dropdown que aparece al click en el botón "Pegar" del top-bar (Pegar solo / Pegar con reglas).
- **Modify:** `src/store/useBuilderStore.ts` — agregar `duplicateWidget(id, options)` y `insertWidget(widget, insertAfterId?)`.
- **Modify:** `src/components/builder/BuilderCanvas.tsx` (`SortableItem`) — agregar botón `⋮` que dispara el menú, junto al `✕`.
- **Modify:** `src/components/builder/BuilderLayout.tsx` — agregar botón "Pegar" en el top-bar (visible solo cuando hay algo en clipboard).

### Helpers puros — `src/lib/widgetClone.ts`

```ts
import { randomUUID } from "../utils/uuid";
import type { WidgetInstance, FormRule } from "../types/widget.types";

export function cloneWidgetWithNewId(widget: WidgetInstance): { widget: WidgetInstance; newId: string } {
  const newId = randomUUID();
  const cloned: WidgetInstance = {
    ...widget,
    id: newId,
    // Nota: deep-clone del config para evitar mutaciones cruzadas entre widget original y clon.
    config: JSON.parse(JSON.stringify(widget.config)) as Record<string, unknown>,
    label: `${widget.label} (copia)`,
  };
  return { widget: cloned, newId };
}

/**
 * Devuelve las reglas donde `oldId` aparece (como condition source o como target),
 * con oldId reemplazado por newId. La regla original NO se modifica; se devuelve
 * un array de reglas NUEVAS listas para agregar al form.
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
 * Filtra reglas cuyos widgetId (en conditions o targetWidgetIds) referencien
 * widgets que NO existen en el form destino. Devuelve las reglas viables +
 * el conteo de descartadas.
 */
export function filterViableRulesForForm(
  rules: FormRule[],
  existingWidgetIds: Set<string>,
): { viable: FormRule[]; discarded: number } {
  const viable: FormRule[] = [];
  let discarded = 0;
  for (const rule of rules) {
    const allConditionsValid = rule.conditions.every((c) => existingWidgetIds.has(c.widgetId));
    const allTargetsValid = rule.targetWidgetIds.every((id) => existingWidgetIds.has(id));
    if (allConditionsValid && allTargetsValid) viable.push(rule);
    else discarded += 1;
  }
  return { viable, discarded };
}
```

### Clipboard model — localStorage

Key: `soulforms-widget-clipboard`
Value shape:
```ts
type WidgetClipboard = {
  widget: WidgetInstance;
  rules: FormRule[];        // vacío [] si se copió "solo widget"
  sourceFormId: string;
  copiedAt: number;         // timestamp epoch
};
```

Acciones:
- **Copiar** (con o sin reglas): serializa `{widget, rules, sourceFormId, copiedAt}` a JSON y `localStorage.setItem(...)`.
- **Pegar**: `localStorage.getItem(...)`, parsea, valida shape (defensive), inserta.
- Si el JSON del clipboard es inválido, se ignora silenciosamente (mismo efecto que no tener nada copiado).
- El clipboard sobrevive close del tab si el navegador no limpia localStorage.

**Detección en top-bar** para mostrar/ocultar el botón "Pegar":
- Hook `useClipboardWidget()` que lee `localStorage` en un `useEffect + storage event listener`. Retorna `null` si vacío, `WidgetClipboard` si presente.
- El botón "Pegar" solo se renderiza si el hook devuelve un valor.

### Store — nuevos métodos en `useBuilderStore`

```ts
// En BuilderState interface:
duplicateWidget: (id: string, options: { withRules: boolean }) => { newId: string; ruleClones: FormRule[] };
insertWidget: (widget: WidgetInstance, insertAfterId?: string) => void;
```

- `duplicateWidget`:
  - Encuentra el widget por id.
  - Usa `cloneWidgetWithNewId` para crear el clon.
  - Lo inserta **inmediatamente después** del original en el array `widgets`.
  - Si `options.withRules === true`, invoca `cloneRulesForNewWidget(rules, oldId, newId)` con las rules del form actual (obtenidas via prop desde el componente que llama, ya que el store no conoce rules).
  - Devuelve `{ newId, ruleClones }`. El componente que llama es responsable de persistir `ruleClones` en `useFolderStore` via `saveFormRules`.
- `insertWidget`:
  - Inserta un widget ya construido (típicamente proveniente del clipboard) al final del array (o después de `insertAfterId` si se pasa).
  - Genera un nuevo id para el widget insertado, para evitar colisiones si el widget viene de otro form con mismo id (raro pero posible).

### UI — `WidgetActionMenu` (dropdown ⋮ por widget)

Menu items:
1. 🗂️ **Duplicar** — invoca `duplicateWidget(id, { withRules: false })`.
2. 🗂️ **Duplicar con reglas** — invoca `duplicateWidget(id, { withRules: true })` y luego `saveFormRules(folderId, formId, [...existingRules, ...ruleClones])`.
3. 📋 **Copiar** — serializa `{widget, rules: [], sourceFormId, copiedAt}` a localStorage.
4. 📋 **Copiar con reglas** — serializa `{widget, rules: cloneRulesForNewWidget(rules, id, id), sourceFormId, copiedAt}` (nota: preservamos las rules relacionadas con el widget copiado, con IDs actuales; al pegar en otro form se remap.eará el widget a un nuevo id y las rules también).

Estilo: dropdown pequeño, aparece bajo el botón `⋮`. Click fuera cierra. Componente stateless, controlado por el parent con `useState`.

### UI — `PasteMenu` (dropdown "Pegar" en top-bar)

Menu items (solo si hay contenido en clipboard):
1. 📋 **Pegar (solo widget)** — usa `cloneWidgetWithNewId(clipboard.widget)` → `insertWidget(cloned)`.
2. 📋 **Pegar con reglas** — usa `cloneWidgetWithNewId`; luego `cloneRulesForNewWidget(clipboard.rules, clipboard.widget.id, newId)` para remapear al nuevo id; luego `filterViableRulesForForm(rulesRemapped, existingWidgetIds)` para descartar reglas que referencien widgets inexistentes en el destino; luego `saveFormRules(...)` con las viables. Toast: `"Widget pegado. N reglas agregadas${discarded > 0 ? `, ${discarded} descartadas (referencian widgets que no existen en este form)` : ''}"`.

### BuilderCanvas — botón `⋮` junto al `✕`

En `SortableItem` (línea ~79-92 del archivo actual):
- Agregar un botón `⋮` a la izquierda del `✕`, mismo estilo visual (posición absolute top-right, colores muted).
- Click en el botón abre `WidgetActionMenu` posicionado debajo.
- El menú se cierra al click en un item o click fuera.
- Compatibilidad: el drag handle (`⠿`) sigue funcionando; el menú `⋮` no interfiere con el drag (usa `onClick` con `stopPropagation`).

### BuilderLayout — botón "Pegar" en top-bar

En el top-bar del builder (donde están otros botones como "Publicar", "Historial", "Reglas"):
- Botón "📋 Pegar" que solo se renderiza cuando el hook `useClipboardWidget()` devuelve valor.
- Click abre `PasteMenu` con las 2 opciones.
- El label del botón puede incluir el nombre del widget en clipboard: `📋 Pegar "Cédula"` para dar contexto.

### Backend

Ningún cambio backend. Todos los cambios son frontend (store + componentes + localStorage).

### Testing

- Manual E2E: crear un widget en un form → click `⋮` → Duplicar → verificar que aparece copia adyacente con `(copia)` en el label.
- Manual E2E: crear widget → agregar regla que lo referencie → Duplicar con reglas → verificar que la regla también se clonó con el nuevo id.
- Manual E2E: copiar widget en form A → abrir form B → verificar que aparece botón "Pegar" en top-bar → Pegar → widget aparece.
- Manual E2E: copiar widget con reglas en form A → pegar en form B → verificar toast con conteo de reglas pegadas/descartadas.
- Manual E2E: clipboard vacío → verificar que el botón "Pegar" no aparece en top-bar.

---

## Error handling

- **Search:** si el source falla al hacer `q=""` (nuevo path), catch como hoy — mostrar tabla vacía y log a consola. Sin toast bloqueante.
- **Copy/Paste:**
  - Clipboard corrupto (JSON inválido en localStorage): `catch` silencioso, tratar como vacío, no mostrar botón "Pegar".
  - Al pegar, si el widget del clipboard tiene un `type` que NO existe en el `widgetRegistry` (por ejemplo, se copió antes de un rollback de código), mostrar toast rojo: `"No se puede pegar: tipo de widget desconocido"` y no insertar.
  - Al pegar con reglas, si TODAS las reglas se descartan (ninguna aplica al form destino), mostrar toast informativo: `"Widget pegado. Las reglas asociadas no aplican en este formulario"`.

## Backward compatibility

- Ningún cambio afecta forms/submissions existentes.
- El store agrega métodos nuevos sin quitar los existentes.
- El `WidgetInstance.config` no cambia de shape (solo se lee y clona).
- El `FormRule` no cambia de shape.
- Sin migraciones de datos.

## Fuera de alcance

Explícitamente NO incluidos:

- Copy/paste selectivo de múltiples widgets a la vez (solo uno a la vez).
- Historial de clipboard (solo el último copiado se conserva; el siguiente lo sobrescribe).
- Copy/paste vía OS clipboard (navigator.clipboard) — usamos solo localStorage.
- Configuración de `PREVIEW_LIMIT` en el widget Search — hardcoded a 50 en esta pasada.
- Refactor de reglas ni otros widgets no listados.
- Nuevas dependencias npm.
- Cambios en el schema de Mongoose de forms/rules.

## Deliverable esperado por fase (para el plan)

Cada sección arriba corresponde a **una task** del plan de implementación:

1. **Task 1 — Search visible**: modal + 5 sources + verificación endpoint backend.
2. **Task 2 — Copy/Paste widgets**: helpers puros + store + WidgetActionMenu + PasteMenu + botones en Canvas y Layout.

Task 2 es la más compleja (múltiples archivos, UI nueva). Task 1 es mecánica (cambio localizado en modal + sources).
