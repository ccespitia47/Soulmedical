export type SubformFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "radio";

export type SubformField = {
  id: string;
  type: SubformFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
};

export type SubformEntry = Record<string, string>;

// ── Reglas internas del subformulario ──────────────────────────────────────

export type SubformRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_empty"
  | "is_empty";

export type SubformCondition = {
  fieldId: string;
  operator: SubformRuleOperator;
  value: string;
};

export type SubformRule = {
  id: string;
  name: string;
  matchType: "all" | "any";
  conditions: SubformCondition[];
  action: "show" | "hide";
  targetFieldIds: string[];
};

export function evaluateSubformRules(
  rules: SubformRule[],
  values: Record<string, string>
): Set<string> {
  const hidden = new Set<string>();

  for (const rule of rules) {
    const results = rule.conditions.map((c) => {
      const val = (values[c.fieldId] ?? "").toLowerCase().trim();
      const target = (c.value ?? "").toLowerCase().trim();
      switch (c.operator) {
        case "equals":     return val === target;
        case "not_equals": return val !== target;
        case "contains":   return val.includes(target);
        case "not_empty":  return val !== "";
        case "is_empty":   return val === "";
        default:           return false;
      }
    });

    const met =
      rule.conditions.length === 0
        ? true
        : rule.matchType === "all"
        ? results.every(Boolean)
        : results.some(Boolean);

    if (met && rule.action === "hide") {
      rule.targetFieldIds.forEach((id) => hidden.add(id));
    } else if (!met && rule.action === "show") {
      rule.targetFieldIds.forEach((id) => hidden.add(id));
    }
  }

  // Segunda pasada: show explícito desbloqueado
  for (const rule of rules) {
    if (rule.action !== "show") continue;
    const results = rule.conditions.map((c) => {
      const val = (values[c.fieldId] ?? "").toLowerCase().trim();
      const target = (c.value ?? "").toLowerCase().trim();
      switch (c.operator) {
        case "equals":     return val === target;
        case "not_equals": return val !== target;
        case "contains":   return val.includes(target);
        case "not_empty":  return val !== "";
        case "is_empty":   return val === "";
        default:           return false;
      }
    });
    const met =
      rule.conditions.length === 0
        ? true
        : rule.matchType === "all"
        ? results.every(Boolean)
        : results.some(Boolean);
    if (met) rule.targetFieldIds.forEach((id) => hidden.delete(id));
  }

  return hidden;
}