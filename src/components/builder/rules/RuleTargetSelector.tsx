import type { RuleAction, WidgetInstance } from "../../../types/widget.types";

type RuleTargetSelectorProps = {
  targetWidgets: WidgetInstance[];
  selectedIds: string[];
  action: RuleAction;
  onToggle: (widgetId: string) => void;
};

// Separador para IDs compuestos "widgetId::opcion" — permite reglas que
// muestran/ocultan opciones individuales de select/radio/checkbox dentro del
// mismo array `targetWidgetIds` sin cambiar el schema.
const OPTION_SEP = "::";

const OPTIONED_TYPES = new Set(["select", "radio", "checkbox"]);

// Extrae los labels de las opciones de un widget. Normaliza los dos shapes
// vigentes: array de strings (legacy) y array de {label}.
function getOptionLabels(w: WidgetInstance): string[] {
  const raw = (w.config.options as unknown[]) ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return typeof o.label === "string" ? o.label : "";
      }
      return "";
    })
    .filter((v) => v !== "");
}

export default function RuleTargetSelector({
  targetWidgets,
  selectedIds,
  action,
  onToggle,
}: RuleTargetSelectorProps) {
  const accent = action === "show" ? "#00c2a8" : "#ef4444";
  const accentBg = action === "show" ? "#e6faf7" : "#fef2f2";

  const chip = (id: string, label: string, isOption: boolean) => {
    const selected = selectedIds.includes(id);
    return (
      <button
        key={id}
        onClick={() => onToggle(id)}
        className="cursor-pointer rounded-[20px] border-[1.5px] px-3 py-1.5 text-xs transition-all"
        style={{
          background: selected ? accentBg : "#f3f4f6",
          borderColor: selected ? accent : "#e2e8f0",
          color: selected ? accent : "#6b7280",
          fontWeight: selected ? 700 : 500,
          fontSize: isOption ? 11 : 12,
          paddingInline: isOption ? 10 : 12,
          paddingBlock: isOption ? 4 : 6,
        }}
      >
        {selected ? (action === "show" ? "👁 " : "🙈 ") : ""}
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-gray-500">
        Campos afectados
      </div>
      {targetWidgets.length === 0 && (
        <div className="py-2 text-xs text-gray-400">No hay campos disponibles</div>
      )}
      <div className="flex flex-col gap-3">
        {targetWidgets.map((w) => {
          const options = OPTIONED_TYPES.has(w.type) ? getOptionLabels(w) : [];
          return (
            <div key={w.id} className="flex flex-wrap items-center gap-2">
              {chip(w.id, w.label, false)}
              {options.length > 0 && (
                <>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    opciones:
                  </span>
                  {options.map((opt) =>
                    chip(`${w.id}${OPTION_SEP}${opt}`, opt, true),
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
