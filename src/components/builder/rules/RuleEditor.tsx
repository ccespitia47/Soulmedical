import { useState } from "react";
import type {
  FormRule,
  RuleAction,
  RuleCondition,
  WidgetInstance,
} from "../../../types/widget.types";
import RuleConditionRow from "./RuleConditionRow";
import RuleTargetSelector from "./RuleTargetSelector";

const TRIGGER_TYPES = [
  "select",
  "radio",
  "checkbox",
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "date",
  "subform",
];
const UNTARGETABLE_TYPES: string[] = [];

type RuleEditorProps = {
  rule: FormRule;
  widgets: WidgetInstance[];
  onUpdate: (r: FormRule) => void;
  onDelete: () => void;
};

export default function RuleEditor({
  rule,
  widgets,
  onUpdate,
  onDelete,
}: RuleEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const triggerWidgets = widgets.filter((w) => TRIGGER_TYPES.includes(w.type));
  const targetWidgets = widgets.filter((w) => !UNTARGETABLE_TYPES.includes(w.type));

  const getOptions = (widgetId: string): string[] => {
    const w = widgets.find((w) => w.id === widgetId);
    if (!w) return [];
    return (w.config.options as string[]) ?? [];
  };

  const addCondition = () => {
    const first = triggerWidgets[0];
    if (!first) return;
    const newCond: RuleCondition = {
      widgetId: first.id,
      operator: "equals",
      value: "",
    };
    onUpdate({ ...rule, conditions: [...rule.conditions, newCond] });
  };

  const updateCondition = (idx: number, changes: Partial<RuleCondition>) => {
    const updated = rule.conditions.map((c, i) =>
      i === idx ? { ...c, ...changes } : c
    );
    onUpdate({ ...rule, conditions: updated });
  };

  const removeCondition = (idx: number) =>
    onUpdate({ ...rule, conditions: rule.conditions.filter((_, i) => i !== idx) });

  const toggleTarget = (widgetId: string) => {
    const has = rule.targetWidgetIds.includes(widgetId);
    onUpdate({
      ...rule,
      targetWidgetIds: has
        ? rule.targetWidgetIds.filter((id) => id !== widgetId)
        : [...rule.targetWidgetIds, widgetId],
    });
  };

  return (
    <div className="mb-3 overflow-hidden rounded-xl border-[1.5px] border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <div
        className="flex cursor-pointer items-center justify-between bg-slate-50 px-4 py-3"
        style={{ borderBottom: collapsed ? "none" : "1px solid #e2e8f0" }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{collapsed ? "▶" : "▼"}</span>
          <input
            value={rule.name}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate({ ...rule, name: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Nombre de la regla"
            className="w-[200px] rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-bold text-gray-900 outline-none"
          />
          <span
            className="rounded-[20px] px-2 py-0.5 text-[11px] font-bold"
            style={{
              background: rule.action === "show" ? "#e6faf7" : "#fef2f2",
              color: rule.action === "show" ? "#00c2a8" : "#ef4444",
            }}
          >
            {rule.action === "show" ? "👁 Mostrar" : "🙈 Ocultar"}
          </span>
          <span className="text-[11px] text-gray-400">
            {rule.targetWidgetIds.length} campo
            {rule.targetWidgetIds.length !== 1 ? "s" : ""} afectado
            {rule.targetWidgetIds.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer border-none bg-transparent px-1.5 py-0.5 text-lg text-gray-400"
        >
          🗑️
        </button>
      </div>

      {!collapsed && (
        <div className="px-[18px] py-4">
          <div className="mb-4">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="text-[13px] font-bold text-gray-700">Condiciones</span>
              <span className="text-xs text-gray-500">Cuando</span>
              <select
                value={rule.matchType}
                onChange={(e) =>
                  onUpdate({ ...rule, matchType: e.target.value as "all" | "any" })
                }
                className="w-[100px] cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-gray-900 outline-none"
              >
                <option value="all">TODAS</option>
                <option value="any">ALGUNA</option>
              </select>
              <span className="text-xs text-gray-500">de estas condiciones coincidan:</span>
            </div>

            {rule.conditions.length === 0 && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-center text-xs text-gray-400">
                Sin condiciones — la regla siempre se aplicará
              </div>
            )}

            {rule.conditions.map((cond, idx) => (
              <RuleConditionRow
                key={idx}
                condition={cond}
                triggerWidgets={triggerWidgets}
                getOptions={getOptions}
                onUpdate={(changes) => updateCondition(idx, changes)}
                onRemove={() => removeCondition(idx)}
              />
            ))}

            <button
              onClick={addCondition}
              disabled={triggerWidgets.length === 0}
              className="mt-1 rounded-[7px] border-[1.5px] border-dashed border-[#00c2a8] bg-transparent px-3.5 py-1.5 text-xs font-semibold text-[#00c2a8] disabled:cursor-not-allowed"
              style={{ cursor: triggerWidgets.length === 0 ? "not-allowed" : "pointer" }}
            >
              + Añadir condición
            </button>
          </div>

          <div className="mb-4 flex items-center gap-2.5">
            <span className="text-[13px] font-bold text-gray-700">Acción</span>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {(["show", "hide"] as RuleAction[]).map((a) => {
                const active = rule.action === a;
                return (
                  <button
                    key={a}
                    onClick={() => onUpdate({ ...rule, action: a })}
                    className="cursor-pointer rounded-md border-none px-3.5 py-1 text-xs font-bold transition-all"
                    style={{
                      background: active
                        ? a === "show"
                          ? "#00c2a8"
                          : "#ef4444"
                        : "transparent",
                      color: active ? "#fff" : "#6b7280",
                    }}
                  >
                    {a === "show" ? "👁 Mostrar" : "🙈 Ocultar"}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-gray-500">los siguientes campos:</span>
          </div>

          <RuleTargetSelector
            targetWidgets={targetWidgets}
            selectedIds={rule.targetWidgetIds}
            action={rule.action}
            onToggle={toggleTarget}
          />
        </div>
      )}
    </div>
  );
}
