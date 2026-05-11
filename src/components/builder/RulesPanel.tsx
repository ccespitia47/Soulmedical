import { useState } from "react";
import type { FormRule, RuleCondition, RuleOperator, RuleAction, WidgetInstance } from "../../types/widget.types";

// Widgets que pueden ser fuente de condición (tienen valores seleccionables)
const TRIGGER_TYPES = ["select", "radio", "checkbox", "text", "textarea", "number", "email", "phone", "date"];

// Widgets que NO pueden ser objetivo (no tiene sentido ocultar un header vacío tampoco pero sí se permite)
const UNTARGETABLE_TYPES: string[] = [];

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals:     "es igual a",
  not_equals: "no es igual a",
  contains:   "contiene",
  not_empty:  "no está vacío",
  is_empty:   "está vacío",
};

const OPERATORS_WITH_VALUE: RuleOperator[] = ["equals", "not_equals", "contains"];

type RulesPanelProps = {
  widgets: WidgetInstance[];
  rules: FormRule[];
  onChange: (rules: FormRule[]) => void;
  onClose?: () => void;
};

// ── Componente editor de una sola regla ──────────────────────────────────────
function RuleEditor({
  rule,
  widgets,
  onUpdate,
  onDelete,
}: {
  rule: FormRule;
  widgets: WidgetInstance[];
  onUpdate: (r: FormRule) => void;
  onDelete: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const triggerWidgets = widgets.filter(w => TRIGGER_TYPES.includes(w.type));
  const targetWidgets  = widgets.filter(w => !UNTARGETABLE_TYPES.includes(w.type));

  // Obtener opciones de un widget (select / radio / checkbox)
  const getOptions = (widgetId: string): string[] => {
    const w = widgets.find(w => w.id === widgetId);
    if (!w) return [];
    return (w.config.options as string[]) ?? [];
  };

  const addCondition = () => {
    const first = triggerWidgets[0];
    if (!first) return;
    const newCond: RuleCondition = { widgetId: first.id, operator: "equals", value: "" };
    onUpdate({ ...rule, conditions: [...rule.conditions, newCond] });
  };

  const updateCondition = (idx: number, changes: Partial<RuleCondition>) => {
    const updated = rule.conditions.map((c, i) => i === idx ? { ...c, ...changes } : c);
    onUpdate({ ...rule, conditions: updated });
  };

  const removeCondition = (idx: number) => {
    onUpdate({ ...rule, conditions: rule.conditions.filter((_, i) => i !== idx) });
  };

  const toggleTarget = (widgetId: string) => {
    const has = rule.targetWidgetIds.includes(widgetId);
    onUpdate({
      ...rule,
      targetWidgetIds: has
        ? rule.targetWidgetIds.filter(id => id !== widgetId)
        : [...rule.targetWidgetIds, widgetId],
    });
  };

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", border: "1.5px solid #e2e8f0", borderRadius: 7,
    fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff",
    color: "#111827",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

  return (
    <div style={{
      border: "1.5px solid #e2e8f0", borderRadius: 12,
      background: "#fff", marginBottom: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      {/* Header de la regla */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "#f8fafc",
        borderBottom: collapsed ? "none" : "1px solid #e2e8f0",
        cursor: "pointer",
      }} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>{collapsed ? "▶" : "▼"}</span>
          <input
            value={rule.name}
            onChange={e => { e.stopPropagation(); onUpdate({ ...rule, name: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            style={{ ...inputStyle, fontWeight: 700, fontSize: 13, width: 200 }}
            placeholder="Nombre de la regla"
          />
          {/* Badge acción */}
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
            background: rule.action === "show" ? "#e6faf7" : "#fef2f2",
            color: rule.action === "show" ? "#00c2a8" : "#ef4444",
          }}>
            {rule.action === "show" ? "👁 Mostrar" : "🙈 Ocultar"}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {rule.targetWidgetIds.length} campo{rule.targetWidgetIds.length !== 1 ? "s" : ""} afectado{rule.targetWidgetIds.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, padding: "2px 6px" }}
        >🗑️</button>
      </div>

      {!collapsed && (
        <div style={{ padding: "16px 18px" }}>

          {/* ── Condiciones ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Condiciones</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Cuando</span>
              <select
                value={rule.matchType}
                onChange={e => onUpdate({ ...rule, matchType: e.target.value as "all" | "any" })}
                style={{ ...selectStyle, width: 100 }}
              >
                <option value="all">TODAS</option>
                <option value="any">ALGUNA</option>
              </select>
              <span style={{ fontSize: 12, color: "#6b7280" }}>de estas condiciones coincidan:</span>
            </div>

            {rule.conditions.length === 0 && (
              <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                Sin condiciones — la regla siempre se aplicará
              </div>
            )}

            {rule.conditions.map((cond, idx) => {
              const options = getOptions(cond.widgetId);
              const needsValue = OPERATORS_WITH_VALUE.includes(cond.operator);
              return (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  marginBottom: 8, flexWrap: "wrap",
                }}>
                  {/* Campo disparador */}
                  <select
                    value={cond.widgetId}
                    onChange={e => updateCondition(idx, { widgetId: e.target.value, value: "" })}
                    style={{ ...selectStyle, flex: "0 0 180px", minWidth: 140 }}
                  >
                    {triggerWidgets.map(w => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>

                  {/* Operador */}
                  <select
                    value={cond.operator}
                    onChange={e => updateCondition(idx, { operator: e.target.value as RuleOperator, value: "" })}
                    style={{ ...selectStyle, flex: "0 0 150px", minWidth: 120 }}
                  >
                    {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                      <option key={op} value={op}>{label}</option>
                    ))}
                  </select>

                  {/* Valor */}
                  {needsValue && (
                    options.length > 0 ? (
                      <select
                        value={cond.value}
                        onChange={e => updateCondition(idx, { value: e.target.value })}
                        style={{ ...selectStyle, flex: "0 0 150px", minWidth: 120 }}
                      >
                        <option value="">-- Selecciona --</option>
                        {options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={cond.value}
                        onChange={e => updateCondition(idx, { value: e.target.value })}
                        placeholder="Valor..."
                        style={{ ...inputStyle, flex: "0 0 150px", minWidth: 120 }}
                      />
                    )
                  )}

                  <button
                    onClick={() => removeCondition(idx)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: "4px" }}
                  >✕</button>
                </div>
              );
            })}

            <button
              onClick={addCondition}
              disabled={triggerWidgets.length === 0}
              style={{
                padding: "7px 14px", background: "none",
                border: "1.5px dashed #00c2a8", borderRadius: 7,
                color: "#00c2a8", fontSize: 12, fontWeight: 600,
                cursor: triggerWidgets.length === 0 ? "not-allowed" : "pointer",
                marginTop: 4,
              }}
            >
              + Añadir condición
            </button>
          </div>

          {/* ── Acción ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Acción</span>
              <div style={{ display: "flex", gap: 4, background: "#f3f4f6", padding: 4, borderRadius: 8 }}>
                {(["show", "hide"] as RuleAction[]).map(a => (
                  <button key={a} onClick={() => onUpdate({ ...rule, action: a })}
                    style={{
                      padding: "5px 14px",
                      background: rule.action === a ? (a === "show" ? "#00c2a8" : "#ef4444") : "transparent",
                      color: rule.action === a ? "#fff" : "#6b7280",
                      border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {a === "show" ? "👁 Mostrar" : "🙈 Ocultar"}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 12, color: "#6b7280" }}>los siguientes campos:</span>
            </div>
          </div>

          {/* ── Campos objetivo ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Campos afectados
            </div>
            {targetWidgets.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "8px 0" }}>No hay campos disponibles</div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {targetWidgets.map(w => {
                const selected = rule.targetWidgetIds.includes(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleTarget(w.id)}
                    style={{
                      padding: "6px 12px",
                      background: selected ? (rule.action === "show" ? "#e6faf7" : "#fef2f2") : "#f3f4f6",
                      border: `1.5px solid ${selected ? (rule.action === "show" ? "#00c2a8" : "#ef4444") : "#e2e8f0"}`,
                      borderRadius: 20,
                      fontSize: 12, fontWeight: selected ? 700 : 500,
                      color: selected ? (rule.action === "show" ? "#00c2a8" : "#ef4444") : "#6b7280",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {selected ? (rule.action === "show" ? "👁 " : "🙈 ") : ""}{w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RulesPanel principal
// ══════════════════════════════════════════════════════════════════════════════
export default function RulesPanel({ widgets, rules, onChange, onClose }: RulesPanelProps) {

  const addRule = () => {
    const newRule: FormRule = {
      id: crypto.randomUUID(),
      name: `Regla ${rules.length + 1}`,
      matchType: "all",
      conditions: [],
      action: "show",
      targetWidgetIds: [],
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id: string, updated: FormRule) => {
    onChange(rules.map(r => r.id === id ? updated : r));
  };

  const deleteRule = (id: string) => {
    onChange(rules.filter(r => r.id !== id));
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px", borderBottom: "1px solid #e2e8f0",
      }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>⚙️ Reglas</h2>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
            Mostrar u ocultar campos bajo ciertas condiciones
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af" }}>✕</button>
        )}
      </div>

      {/* Lista de reglas */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

        {widgets.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: 10 }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📋</span>
            <p style={{ fontSize: 13, margin: 0 }}>Agrega campos al formulario primero para crear reglas</p>
          </div>
        )}

        {widgets.length > 0 && rules.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🔀</span>
            <p style={{ fontSize: 13, margin: "0 0 4px", fontWeight: 600 }}>Sin reglas configuradas</p>
            <p style={{ fontSize: 12, margin: 0 }}>Crea una regla para mostrar u ocultar campos dinámicamente</p>
          </div>
        )}

        {rules.map(rule => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            widgets={widgets}
            onUpdate={updated => updateRule(rule.id, updated)}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
      </div>

      {/* Footer */}
      {widgets.length > 0 && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid #e2e8f0" }}>
          <button
            onClick={addRule}
            style={{
              width: "100%", padding: "10px 14px",
              background: "linear-gradient(135deg, #00c2a8, #00a892)",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 2px 8px rgba(0,194,168,0.3)",
            }}
          >
            ➕ Nueva regla
          </button>
        </div>
      )}
    </div>
  );
}