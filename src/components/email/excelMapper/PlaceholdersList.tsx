import type { ExcelFieldMapping } from "../../../types/email-template.types";

export type PlaceholderItem = {
  placeholder: string;
  description: string;
  widgetType?: string;
};

type PlaceholdersListProps = {
  placeholders: PlaceholderItem[];
  selected: PlaceholderItem | null;
  mappings: Record<string, ExcelFieldMapping>;
  onSelect: (p: PlaceholderItem | null) => void;
};

export default function PlaceholdersList({
  placeholders,
  selected,
  mappings,
  onSelect,
}: PlaceholdersListProps) {
  if (placeholders.length === 0) {
    return (
      <>
        <div className="px-3.5 pb-1.5 pt-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-gray-700">
          📋 Campos del Formulario
        </div>
        <div className="mt-2 p-4 text-center text-xs text-gray-400">
          No hay campos en el formulario.
          <br />
          Agrega widgets primero.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="px-3.5 pb-1.5 pt-2.5 text-[11px] font-bold uppercase tracking-[0.5px] text-gray-700">
        📋 Campos del Formulario
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {placeholders.map((p, i) => {
          const isSel = selected?.placeholder === p.placeholder;
          const isMapped = Object.values(mappings).some((m) => m.placeholder === p.placeholder);
          return (
            <div
              key={i}
              onClick={() => onSelect(isSel ? null : p)}
              className="mb-[3px] cursor-pointer rounded-[7px] px-2.5 py-[7px] transition-all"
              style={{
                border: isSel
                  ? "2px solid #3b82f6"
                  : isMapped
                  ? "2px solid #22c55e"
                  : "1.5px solid #f1f5f9",
                background: isSel ? "#eff6ff" : isMapped ? "#f0fdf4" : "#fff",
                boxShadow: isSel ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
              }}
            >
              <div
                className="mb-[1px] font-mono text-[10.5px] font-semibold"
                style={{
                  color: isSel ? "#1d4ed8" : isMapped ? "#15803d" : "#374151",
                }}
              >
                {isMapped ? "✅ " : isSel ? "👆 " : ""}
                {p.placeholder}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {p.description}
                {p.widgetType && (
                  <span className="rounded bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500">
                    {p.widgetType}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function PlaceholderInstruction({ selected }: { selected: PlaceholderItem | null }) {
  return (
    <div
      className="border-t border-slate-100 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 transition-colors"
      style={{ background: selected ? "#eff6ff" : "#f8fafc" }}
    >
      {selected ? (
        <>
          <span className="font-bold text-blue-700">✋ Seleccionado:</span>
          <br />
          <span className="font-mono text-[10px] text-blue-800">{selected.placeholder}</span>
          <br />
          <span className="text-blue-500">→ Haz clic en una celda del Excel</span>
        </>
      ) : (
        <span>Selecciona un campo arriba para empezar a mapear.</span>
      )}
    </div>
  );
}
