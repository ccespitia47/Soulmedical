import type {
  SubformCondition,
  SubformField,
  SubformRule,
  SubformRuleOperator,
} from "../subform.types";
import Icon from "../../../common/Icon";
import {
  HAS_VALUE_OPTIONS,
  OPERATORS_WITH_VALUE,
  OPERATOR_LABELS,
} from "./constants";

const SMALL_SELECT_CLASS =
  "cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2 py-1 font-sans text-xs text-slate-900 outline-none focus:border-[#00c2a8]";

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
        (condition.operator === "has_value" ? (
          <select
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={SMALL_SELECT_CLASS}
            style={{ flex: "0 0 140px" }}
          >
            <option value="">-- Selecciona --</option>
            {HAS_VALUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : options.length > 0 ? (
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
        aria-label="Eliminar condición"
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Icon name="x" size={13} />
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              background: selected ? accentBg : "#f8fafc",
              borderColor: selected ? accent : "#e2e8f0",
              color: selected ? accent : "#64748b",
            }}
          >
            {selected && (
              <Icon
                name={rule.action === "show" ? "eye" : "eyeOff"}
                size={12}
              />
            )}
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

  const isShow = rule.action === "show";
  const actionAccent = isShow ? "#00c2a8" : "#ef4444";
  const actionBg = isShow ? "#e6faf7" : "#fef2f2";

  return (
    <div className="mb-2.5 overflow-hidden rounded-[10px] border-[1.5px] border-slate-200 bg-white">
      <div
        onClick={onToggleExpanded}
        className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5"
      >
        <span className="flex h-5 w-5 items-center justify-center text-slate-400">
          <Icon
            name="chevronRight"
            size={12}
            className={expanded ? "rotate-90 transition-transform" : "transition-transform"}
          />
        </span>
        <input
          value={rule.name}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate({ name: e.target.value });
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 border-none bg-transparent font-sans text-[13px] font-bold text-slate-900 outline-none"
        />
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: actionBg, color: actionAccent }}
        >
          <Icon name={isShow ? "eye" : "eyeOff"} size={11} />
          {isShow ? "Mostrar" : "Ocultar"}
        </span>
        <span className="text-[11px] text-slate-400">
          {rule.targetFieldIds.length} campos
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Eliminar regla"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {expanded && (
        <div className="bg-white px-4 py-3.5">
          {/* Condiciones */}
          <div className="mb-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Cuando</span>
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
              <span className="text-xs text-slate-500">de estas condiciones:</span>
            </div>

            {rule.conditions.length === 0 && (
              <div className="rounded-[7px] bg-slate-50 px-3 py-2 text-xs text-slate-500">
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
              className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md border-[1.5px] border-dashed border-[#00c2a8] bg-transparent px-3 py-1 text-[11px] font-bold text-[#0891b2] transition-colors hover:bg-[#e6faf7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="plus" size={11} /> Condición
            </button>
          </div>

          {/* Acción */}
          <div className="mb-3.5">
            <span className="mr-2.5 text-xs font-bold text-slate-700">Acción</span>
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-[3px]">
              {(["show", "hide"] as const).map((a) => {
                const active = rule.action === a;
                return (
                  <button
                    key={a}
                    onClick={() => onUpdate({ action: a })}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border-none px-3 py-1 text-xs font-bold transition-colors"
                    style={{
                      background: active
                        ? a === "show"
                          ? "#00c2a8"
                          : "#ef4444"
                        : "transparent",
                      color: active ? "#fff" : "#64748b",
                    }}
                  >
                    <Icon name={a === "show" ? "eye" : "eyeOff"} size={12} />
                    {a === "show" ? "Mostrar" : "Ocultar"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campos afectados */}
          <div>
            <span className="mb-2 block text-xs font-bold text-slate-700">
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
