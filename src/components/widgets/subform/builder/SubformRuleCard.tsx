import type {
  SubformCondition,
  SubformField,
  SubformRule,
  SubformRuleOperator,
} from "../subform.types";
import { OPERATORS_WITH_VALUE, OPERATOR_LABELS } from "./constants";

const SMALL_SELECT_CLASS =
  "cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2 py-1 font-sans text-xs text-gray-900 outline-none";

function ConditionRow({
  condition,
  fields,
  onUpdate,
  onRemove,
}: {
  condition: SubformCondition;
  fields: SubformField[];
  onUpdate: (changes: Partial<SubformCondition>) => void;
  onRemove: () => void;
}) {
  const condField = fields.find((f) => f.id === condition.fieldId);
  const options = condField?.options || [];
  const needsValue = OPERATORS_WITH_VALUE.includes(condition.operator);

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <select
        value={condition.fieldId}
        onChange={(e) => onUpdate({ fieldId: e.target.value, value: "" })}
        className={SMALL_SELECT_CLASS}
        style={{ flex: "0 0 160px" }}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) =>
          onUpdate({
            operator: e.target.value as SubformRuleOperator,
            value: "",
          })
        }
        className={SMALL_SELECT_CLASS}
        style={{ flex: "0 0 140px" }}
      >
        {Object.entries(OPERATOR_LABELS).map(([op, lbl]) => (
          <option key={op} value={op}>
            {lbl}
          </option>
        ))}
      </select>

      {needsValue &&
        (options.length > 0 ? (
          <select
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={SMALL_SELECT_CLASS}
            style={{ flex: "0 0 140px" }}
          >
            <option value="">-- Selecciona --</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Valor..."
            className={`${SMALL_SELECT_CLASS} cursor-text`}
            style={{ flex: "0 0 140px" }}
          />
        ))}

      <button
        onClick={onRemove}
        className="cursor-pointer border-none bg-transparent text-sm text-gray-400"
      >
        ✕
      </button>
    </div>
  );
}

function TargetSelector({
  rule,
  fields,
  onToggle,
}: {
  rule: SubformRule;
  fields: SubformField[];
  onToggle: (fieldId: string) => void;
}) {
  const accent = rule.action === "show" ? "#00c2a8" : "#ef4444";
  const accentBg = rule.action === "show" ? "#e6faf7" : "#fef2f2";
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const selected = rule.targetFieldIds.includes(f.id);
        return (
          <button
            key={f.id}
            onClick={() => onToggle(f.id)}
            className="cursor-pointer rounded-[20px] border-[1.5px] px-3 py-1 text-xs font-semibold"
            style={{
              background: selected ? accentBg : "#f3f4f6",
              borderColor: selected ? accent : "#e2e8f0",
              color: selected ? accent : "#6b7280",
            }}
          >
            {selected ? (rule.action === "show" ? "👁 " : "🙈 ") : ""}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

type SubformRuleCardProps = {
  rule: SubformRule;
  fields: SubformField[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (changes: Partial<SubformRule>) => void;
  onRemove: () => void;
};

export default function SubformRuleCard({
  rule,
  fields,
  expanded,
  onToggleExpanded,
  onUpdate,
  onRemove,
}: SubformRuleCardProps) {
  const addCondition = () => {
    const first = fields[0];
    if (!first) return;
    const c: SubformCondition = {
      fieldId: first.id,
      operator: "equals",
      value: "",
    };
    onUpdate({ conditions: [...rule.conditions, c] });
  };

  const updateCondition = (idx: number, changes: Partial<SubformCondition>) => {
    onUpdate({
      conditions: rule.conditions.map((c, i) =>
        i === idx ? { ...c, ...changes } : c,
      ),
    });
  };

  const removeCondition = (idx: number) => {
    onUpdate({ conditions: rule.conditions.filter((_, i) => i !== idx) });
  };

  const toggleTarget = (fieldId: string) => {
    const has = rule.targetFieldIds.includes(fieldId);
    onUpdate({
      targetFieldIds: has
        ? rule.targetFieldIds.filter((id) => id !== fieldId)
        : [...rule.targetFieldIds, fieldId],
    });
  };

  return (
    <div className="mb-2.5 overflow-hidden rounded-[10px] border-[1.5px] border-slate-200">
      <div
        onClick={onToggleExpanded}
        className="flex cursor-pointer items-center gap-2.5 bg-slate-50 px-3.5 py-2.5"
      >
        <span className="text-xs">{expanded ? "▼" : "▶"}</span>
        <input
          value={rule.name}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate({ name: e.target.value });
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 border-none bg-transparent font-sans text-[13px] font-bold text-gray-900 outline-none"
        />
        <span
          className="rounded-[20px] px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: rule.action === "show" ? "#e6faf7" : "#fef2f2",
            color: rule.action === "show" ? "#00c2a8" : "#ef4444",
          }}
        >
          {rule.action === "show" ? "👁 Mostrar" : "🙈 Ocultar"}
        </span>
        <span className="text-[11px] text-gray-400">
          {rule.targetFieldIds.length} campos
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="cursor-pointer border-none bg-transparent p-0.5 text-sm text-red-300"
        >
          🗑️
        </button>
      </div>

      {expanded && (
        <div className="bg-white px-4 py-3.5">
          {/* Condiciones */}
          <div className="mb-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Cuando</span>
              <select
                value={rule.matchType}
                onChange={(e) =>
                  onUpdate({ matchType: e.target.value as "all" | "any" })
                }
                className={`${SMALL_SELECT_CLASS} w-auto`}
              >
                <option value="all">TODAS</option>
                <option value="any">ALGUNA</option>
              </select>
              <span className="text-xs text-gray-500">de estas condiciones:</span>
            </div>

            {rule.conditions.length === 0 && (
              <div className="rounded-[7px] bg-slate-50 px-3 py-2 text-xs text-gray-400">
                Sin condiciones — la regla siempre se aplica
              </div>
            )}

            {rule.conditions.map((cond, ci) => (
              <ConditionRow
                key={ci}
                condition={cond}
                fields={fields}
                onUpdate={(changes) => updateCondition(ci, changes)}
                onRemove={() => removeCondition(ci)}
              />
            ))}

            <button
              onClick={addCondition}
              disabled={fields.length === 0}
              className="mt-1 cursor-pointer rounded-md border-[1.5px] border-dashed border-[#00c2a8] bg-transparent px-3 py-1 text-[11px] font-bold text-[#00c2a8] disabled:cursor-not-allowed"
            >
              + Condición
            </button>
          </div>

          {/* Acción */}
          <div className="mb-3.5">
            <span className="mr-2.5 text-xs font-bold text-gray-700">Acción</span>
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-[3px]">
              {(["show", "hide"] as const).map((a) => {
                const active = rule.action === a;
                return (
                  <button
                    key={a}
                    onClick={() => onUpdate({ action: a })}
                    className="cursor-pointer rounded-md border-none px-3.5 py-1 text-xs font-bold"
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
          </div>

          {/* Campos afectados */}
          <div>
            <span className="mb-2 block text-xs font-bold text-gray-700">
              Campos afectados
            </span>
            <TargetSelector
              rule={rule}
              fields={fields}
              onToggle={toggleTarget}
            />
          </div>
        </div>
      )}
    </div>
  );
}
