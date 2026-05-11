import type React from "react";

// ─── Reglas condicionales ──────────────────────────────────────────────────────

export type RuleOperator = "equals" | "not_equals" | "contains" | "not_empty" | "is_empty";

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
};

// ─── Props compartidas ─────────────────────────────────────────────────────────

export type WidgetPreviewProps = {
  widget: WidgetInstance;
};

export type WidgetPropertiesProps = {
  widget: WidgetInstance;
  updateWidget: (id: string, changes: Partial<WidgetInstance>) => void;
};

export type WidgetRenderProps = {
  widget: WidgetInstance;
  onValue?: (fields: Record<string, string>) => void;
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