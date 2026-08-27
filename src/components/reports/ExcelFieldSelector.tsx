import { useMemo } from "react";
import type { WidgetInstance } from "../../types/widget.types";

type Field = { id: string; label: string; type: string };

type Props = {
  widgets: WidgetInstance[];
  selectedFieldIds: Set<string>;
  onChange: (next: Set<string>) => void;
};

export default function ExcelFieldSelector({ widgets, selectedFieldIds, onChange }: Props) {
  const fields: Field[] = useMemo(
    () =>
      widgets
        .filter((w) => !!w.label?.trim())
        .map((w) => ({ id: w.id, label: w.label, type: w.type })),
    [widgets],
  );

  const toggleField = (id: string) => {
    const next = new Set(selectedFieldIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[12px] font-medium text-slate-500">
          <span className="font-bold text-[#0891b2]">{selectedFieldIds.size}</span> de{" "}
          {fields.length} campo{fields.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChange(new Set(fields.map((f) => f.id)))}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 transition hover:border-[#00c2a8]/40 hover:text-[#0891b2]"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 transition hover:border-slate-300 hover:text-gray-900"
          >
            Ninguno
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => {
          const checked = selectedFieldIds.has(f.id);
          return (
            <label
              key={f.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 transition-all"
              style={{
                borderColor: checked ? "rgba(0,194,168,0.35)" : "#e2e8f0",
                background: checked ? "rgba(0,194,168,0.06)" : "#fff",
              }}
            >
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[6px] transition-colors"
                style={{
                  border: `2px solid ${checked ? "#00c2a8" : "#cbd5e1"}`,
                  background: checked ? "#00c2a8" : "#fff",
                }}
              >
                {checked && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleField(f.id)}
                className="sr-only"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-gray-900">
                  {f.label}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  {f.type}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
