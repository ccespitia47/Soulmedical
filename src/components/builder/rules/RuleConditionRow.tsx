import type {
  RuleCondition,
  RuleOperator,
  WidgetInstance,
} from "../../../types/widget.types";

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "es igual a",
  not_equals: "no es igual a",
  contains: "contiene",
  not_empty: "no está vacío",
  is_empty: "está vacío",
  has_value: "tiene valor",
};

// Operadores que requieren un input de "value". `has_value` también lo pide,
// pero con un select Si/No en vez de texto/opciones — se maneja aparte abajo.
const OPERATORS_WITH_VALUE: RuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "has_value",
];

const HAS_VALUE_OPTIONS: { value: string; label: string }[] = [
  { value: "si", label: "Si" },
  { value: "no", label: "No" },
];

const SELECT_CLASS =
  "cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-gray-900 outline-none";
const INPUT_CLASS =
  "rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-gray-900 outline-none";

type RuleConditionRowProps = {
  condition: RuleCondition;
  triggerWidgets: WidgetInstance[];
  getOptions: (widgetId: string) => string[];
  onUpdate: (changes: Partial<RuleCondition>) => void;
  onRemove: () => void;
};

export default function RuleConditionRow({
  condition,
  triggerWidgets,
  getOptions,
  onUpdate,
  onRemove,
}: RuleConditionRowProps) {
  const options = getOptions(condition.widgetId);
  const needsValue = OPERATORS_WITH_VALUE.includes(condition.operator);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <select
        value={condition.widgetId}
        onChange={(e) => onUpdate({ widgetId: e.target.value, value: "" })}
        className={SELECT_CLASS}
        style={{ flex: "0 0 180px", minWidth: 140 }}
      >
        {triggerWidgets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) =>
          onUpdate({ operator: e.target.value as RuleOperator, value: "" })
        }
        className={SELECT_CLASS}
        style={{ flex: "0 0 150px", minWidth: 120 }}
      >
        {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
          <option key={op} value={op}>
            {label}
          </option>
        ))}
      </select>

      {needsValue &&
        (condition.operator === "has_value" ? (
          <select
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={SELECT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
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
            className={SELECT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
          >
            <option value="">-- Selecciona --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Valor..."
            className={INPUT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
          />
        ))}

      <button
        onClick={onRemove}
        className="cursor-pointer border-none bg-transparent p-1 text-base text-gray-400"
      >
        ✕
      </button>
    </div>
  );
}
