import type { FormRule } from "../types/widget.types";

/**
 * Mapa opcional `widgetId → fila completa seleccionada`. Lo arman las
 * páginas que renderizan el formulario (FormPage, TaskPage, PublicFormPage,
 * PreviewPage, TaskSharePage) leyendo las claves `${widgetId}__row` que
 * el widget `search` guarda cuando el usuario elige un resultado. Permite
 * a las reglas evaluar `row[column]` en vez de solo el valor principal
 * del widget — ej. "Id Paciente.nombres es Margarita".
 */
export type RuleRowMap = Record<string, Record<string, unknown>>;

function normalize(x: string): string {
  return (x ?? "").toLowerCase().trim();
}

/** Lee el valor a evaluar: si la condición apunta a una columna de un
 *  search, extrae `row[column]`; si no, cae al valor principal del widget. */
function resolveFieldValue(
  cond: FormRule["conditions"][number],
  values: Record<string, string>,
  rows: RuleRowMap,
): string {
  if (cond.column) {
    const row = rows[cond.widgetId];
    const raw = row ? row[cond.column] : undefined;
    if (raw == null) return "";
    return String(raw);
  }
  return values[cond.widgetId] ?? "";
}

function checkCondition(
  cond: FormRule["conditions"][number],
  values: Record<string, string>,
  rows: RuleRowMap,
): boolean {
  const val = normalize(resolveFieldValue(cond, values, rows));
  const target = normalize(cond.value ?? "");
  switch (cond.operator) {
    case "equals":
      return val === target;
    case "not_equals":
      return val !== target;
    case "contains":
      return val.includes(target);
    case "starts_with":
      return target === "" ? false : val.startsWith(target);
    case "ends_with":
      return target === "" ? false : val.endsWith(target);
    case "not_empty":
      return val !== "";
    case "is_empty":
      return val === "";
    case "has_value":
      // target === "si" ⇒ el campo DEBE tener valor para que la condición se
      // cumpla. target === "no" ⇒ el campo NO debe tener valor. Cualquier
      // otro valor del target cuenta como no-cumplida (defensa).
      if (target === "si") return val !== "";
      if (target === "no") return val === "";
      return false;
    default:
      return false;
  }
}

function isRuleMet(
  rule: FormRule,
  values: Record<string, string>,
  rows: RuleRowMap,
): boolean {
  if (rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => checkCondition(c, values, rows));
  return rule.matchType === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function evaluateRules(
  rules: FormRule[],
  values: Record<string, string>,
  rows: RuleRowMap = {},
): Set<string> {
  const hidden = new Set<string>();

  for (const rule of rules) {
    const met = isRuleMet(rule, values, rows);
    if (met && rule.action === "hide") {
      rule.targetWidgetIds.forEach((id) => hidden.add(id));
    } else if (!met && rule.action === "show") {
      rule.targetWidgetIds.forEach((id) => hidden.add(id));
    }
  }

  for (const rule of rules) {
    if (rule.action !== "show") continue;
    if (isRuleMet(rule, values, rows)) rule.targetWidgetIds.forEach((id) => hidden.delete(id));
  }

  return hidden;
}

/**
 * Helper para extraer el mapa de filas seleccionadas a partir del
 * `fieldValues` que las páginas construyen con `new FormData(form)`.
 * Los widgets `search` guardan la fila completa como JSON bajo
 * `${widgetId}__row` — este helper deserializa esas entradas para que
 * `evaluateRules` las use.
 */
export function extractRowsFromValues(
  values: Record<string, string>,
): RuleRowMap {
  const out: RuleRowMap = {};
  for (const [k, v] of Object.entries(values)) {
    if (!k.endsWith("__row")) continue;
    const widgetId = k.slice(0, -"__row".length);
    if (!widgetId || typeof v !== "string" || !v) continue;
    try {
      const parsed = JSON.parse(v) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") out[widgetId] = parsed;
    } catch {
      /* fila mal formada: ignorar en silencio */
    }
  }
  return out;
}
