import { useState } from "react";
import type { SubformField, SubformRule } from "../subform.types";
import Icon from "../../../common/Icon";
import { uid } from "./constants";
import SubformRuleCard from "./SubformRuleCard";

type SubformRulesPanelProps = {
  rules: SubformRule[];
  fields: SubformField[];
  onChange: (rules: SubformRule[]) => void;
};

export default function SubformRulesPanel({
  rules,
  fields,
  onChange,
}: SubformRulesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addRule = () => {
    const r: SubformRule = {
      id: uid(),
      name: `Regla ${rules.length + 1}`,
      matchType: "all",
      conditions: [],
      action: "show",
      targetFieldIds: [],
    };
    onChange([...rules, r]);
    setExpandedId(r.id);
  };

  const updateRule = (id: string, changes: Partial<SubformRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  if (fields.length < 2) {
    return (
      <div className="px-4 py-10 text-center text-slate-400">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Icon name="settings" size={22} />
        </span>
        <p className="m-0 text-[13px] font-semibold text-slate-600">
          Necesitas al menos 2 campos
        </p>
        <p className="mt-1 text-xs">
          Agrega más campos en la pestaña Campos para crear reglas
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-slate-500">
          Muestra u oculta campos según los valores ingresados
        </p>
        <button
          onClick={addRule}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.55)] transition-transform hover:-translate-y-px"
        >
          <Icon name="plus" size={13} /> Nueva regla
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-[10px] border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-slate-500">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400">
            <Icon name="settings" size={20} />
          </span>
          <p className="m-0 text-[13px] font-semibold text-slate-600">Sin reglas</p>
          <p className="mt-1 text-xs text-slate-400">
            Haz clic en "+ Nueva regla" para crear una
          </p>
        </div>
      )}

      {rules.map((rule) => (
        <SubformRuleCard
          key={rule.id}
          rule={rule}
          fields={fields}
          expanded={expandedId === rule.id}
          onToggleExpanded={() =>
            setExpandedId(expandedId === rule.id ? null : rule.id)
          }
          onUpdate={(changes) => updateRule(rule.id, changes)}
          onRemove={() => removeRule(rule.id)}
        />
      ))}
    </div>
  );
}
