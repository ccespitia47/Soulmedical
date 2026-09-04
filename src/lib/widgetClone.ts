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
