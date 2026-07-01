import type { RuleAction, WidgetInstance } from "../../../types/widget.types";

type RuleTargetSelectorProps = {
  targetWidgets: WidgetInstance[];
  selectedIds: string[];
  action: RuleAction;
  onToggle: (widgetId: string) => void;
};

export default function RuleTargetSelector({
  targetWidgets,
  selectedIds,
  action,
  onToggle,
}: RuleTargetSelectorProps) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-gray-500">
        Campos afectados
      </div>
      {targetWidgets.length === 0 && (
        <div className="py-2 text-xs text-gray-400">No hay campos disponibles</div>
      )}
      <div className="flex flex-wrap gap-2">
        {targetWidgets.map((w) => {
          const selected = selectedIds.includes(w.id);
          const accent = action === "show" ? "#00c2a8" : "#ef4444";
          const accentBg = action === "show" ? "#e6faf7" : "#fef2f2";
          return (
            <button
              key={w.id}
              onClick={() => onToggle(w.id)}
              className="cursor-pointer rounded-[20px] border-[1.5px] px-3 py-1.5 text-xs transition-all"
              style={{
                background: selected ? accentBg : "#f3f4f6",
                borderColor: selected ? accent : "#e2e8f0",
                color: selected ? accent : "#6b7280",
                fontWeight: selected ? 700 : 500,
              }}
            >
              {selected ? (action === "show" ? "👁 " : "🙈 ") : ""}
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
