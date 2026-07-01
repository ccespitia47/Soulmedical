import type { FormRule } from "../types/widget.types";

function checkCondition(
  cond: FormRule["conditions"][number],
  values: Record<string, string>
): boolean {
  const val = (values[cond.widgetId] ?? "").toLowerCase().trim();
  const target = (cond.value ?? "").toLowerCase().trim();
  switch (cond.operator) {
    case "equals":
      return val === target;
    case "not_equals":
      return val !== target;
    case "contains":
      return val.includes(target);
    case "not_empty":
      return val !== "";
    case "is_empty":
      return val === "";
    default:
      return false;
  }
}

function isRuleMet(rule: FormRule, values: Record<string, string>): boolean {
  if (rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => checkCondition(c, values));
  return rule.matchType === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function evaluateRules(
  rules: FormRule[],
  values: Record<string, string>
): Set<string> {
  const hidden = new Set<string>();

  for (const rule of rules) {
    const met = isRuleMet(rule, values);
    if (met && rule.action === "hide") {
      rule.targetWidgetIds.forEach((id) => hidden.add(id));
    } else if (!met && rule.action === "show") {
      rule.targetWidgetIds.forEach((id) => hidden.add(id));
    }
  }

  for (const rule of rules) {
    if (rule.action !== "show") continue;
    if (isRuleMet(rule, values)) rule.targetWidgetIds.forEach((id) => hidden.delete(id));
  }

  return hidden;
}
