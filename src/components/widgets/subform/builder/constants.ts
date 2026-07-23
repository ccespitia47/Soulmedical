import type { SubformFieldType, SubformRuleOperator } from "../subform.types";

export const FIELD_TYPES: { value: SubformFieldType; label: string; icon: string }[] = [
  { value: "text",     label: "Texto corto",   icon: "✏️" },
  { value: "textarea", label: "Área de texto", icon: "📝" },
  { value: "number",   label: "Número",        icon: "🔢" },
  { value: "email",    label: "Email",         icon: "✉️" },
  { value: "phone",    label: "Teléfono",      icon: "📞" },
  { value: "date",     label: "Fecha",         icon: "📅" },
  { value: "select",   label: "Desplegable",   icon: "🔽" },
  { value: "checkbox", label: "Casilla",       icon: "☑️" },
  { value: "radio",    label: "Opción única",  icon: "🔘" },
];

export const OPERATOR_LABELS: Record<SubformRuleOperator, string> = {
  equals:    "es igual a",
  not_equals:"no es igual a",
  contains:  "contiene",
  not_empty: "no está vacío",
  is_empty:  "está vacío",
};

export const OPERATORS_WITH_VALUE: SubformRuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
];

export const FIELDS_WITH_OPTIONS: SubformFieldType[] = ["select", "radio", "checkbox"];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Tailwind classes compartidas
export const SUBFORM_INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 outline-none focus:border-[#00c2a8]";

export const SUBFORM_LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-gray-500";
