import type { FormRule, WidgetInstance } from "../../types/widget.types";
import { randomUUID } from "../../utils/uuid";
import RuleEditor from "./rules/RuleEditor";

type RulesPanelProps = {
  widgets: WidgetInstance[];
  rules: FormRule[];
  onChange: (rules: FormRule[]) => void;
  onClose?: () => void;
};

export default function RulesPanel({ widgets, rules, onChange, onClose }: RulesPanelProps) {
  const addRule = () => {
    const newRule: FormRule = {
      id: randomUUID(),
      name: `Regla ${rules.length + 1}`,
      matchType: "all",
      conditions: [],
      action: "show",
      targetWidgetIds: [],
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id: string, updated: FormRule) => {
    onChange(rules.map((r) => (r.id === id ? updated : r)));
  };

  const deleteRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-[18px] py-4">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-gray-900">⚙️ Reglas</h2>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Mostrar u ocultar campos bajo ciertas condiciones
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-lg text-gray-400"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-4">
        {widgets.length === 0 && (
          <div className="rounded-[10px] bg-gray-50 px-4 py-6 text-center text-gray-400">
            <span className="mb-2 block text-3xl">📋</span>
            <p className="m-0 text-[13px]">
              Agrega campos al formulario primero para crear reglas
            </p>
          </div>
        )}

        {widgets.length > 0 && rules.length === 0 && (
          <div className="mb-4 rounded-[10px] bg-gray-50 px-4 py-6 text-center text-gray-400">
            <span className="mb-2 block text-3xl">🔀</span>
            <p className="m-0 mb-1 text-[13px] font-semibold">Sin reglas configuradas</p>
            <p className="m-0 text-xs">
              Crea una regla para mostrar u ocultar campos dinámicamente
            </p>
          </div>
        )}

        {rules.map((rule) => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            widgets={widgets}
            onUpdate={(updated) => updateRule(rule.id, updated)}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
      </div>

      {widgets.length > 0 && (
        <div className="border-t border-slate-200 px-[18px] py-3">
          <button
            onClick={addRule}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#00a892] px-3.5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(0,194,168,0.3)]"
          >
            ➕ Nueva regla
          </button>
        </div>
      )}
    </div>
  );
}
