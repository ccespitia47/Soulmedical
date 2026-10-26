import type React from "react";

// ─── Reglas condicionales ──────────────────────────────────────────────────────

export type RuleOperator = "equals" | "not_equals" | "contains" | "not_empty" | "is_empty" | "has_value";

export type RuleCondition = {
  widgetId: string;   // Campo que dispara la condición
  operator: RuleOperator;
  value: string;      // Valor a comparar (vacío para is_empty / not_empty)
};

export type RuleAction = "show" | "hide";

export type FormRule = {
  id: string;
  name: string;
  // Cuando TODAS o ALGUNA condición se cumple
  matchType: "all" | "any";
  conditions: RuleCondition[];
  action: RuleAction;
  // Widgets afectados por la acción
  targetWidgetIds: string[];
};

// ─── Tipos base ────────────────────────────────────────────────────────────────

export type WidgetInstance = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  /** Clave manual para los placeholders del PDF/Email (`${placeholder}`).
   *  Opcional: si no se define, se usa `normalizeKey(label)` con sufijo
   *  automático en duplicados. Útil cuando hay dos widgets con el mismo
   *  label (ej. dos "Cargo") y el admin quiere identificarlos como
   *  `cargo_jefe` y `cargo_trabajador` en los mappings. */
  placeholder?: string;
};

// ─── Props compartidas ─────────────────────────────────────────────────────────

export type WidgetPreviewProps = {
  widget: WidgetInstance;
};

export type WidgetPropertiesProps = {
  widget: WidgetInstance;
  updateWidget: (id: string, changes: Partial<WidgetInstance>) => void;
  /** Otros widgets del mismo formulario — contexto para propiedades que
   * necesitan referenciar campos hermanos (p.ej. mappings del widget search). */
  allWidgets?: WidgetInstance[];
};

export type WidgetRenderProps = {
  widget: WidgetInstance;
  onValue?: (fields: Record<string, string>) => void;
  /** Valores actuales de todos los campos del formulario. Se pasa a los
   * widgets que necesitan reaccionar a lo que el usuario escribe en OTROS
   * campos (p.ej. `calc` recalcula al vuelo). Undefined para widgets que
   * no lo consumen. */
  fieldValues?: Record<string, string>;
  /** IDs de widgets ocultos por reglas condicionales. Consumido por widgets
   * agregadores para excluir campos que no aplican en la sesión actual. */
  hiddenWidgetIds?: Set<string>;
  /** Todos los widgets del formulario. Consumido por widgets agregadores
   * (ej. `quiz_score`) que necesitan iterar por otros widgets para calcular
   * su valor. Undefined para widgets que no lo consumen. */
  allWidgets?: WidgetInstance[];
};

// ─── Definición de un widget en el registry ───────────────────────────────────

export type WidgetDefinition = {
  type: string;
  label: string;
  icon: string;
  defaultConfig: Record<string, unknown>;
  preview: React.ComponentType<WidgetPreviewProps>;
  properties: React.ComponentType<WidgetPropertiesProps>;
  render: React.ComponentType<WidgetRenderProps>;
};