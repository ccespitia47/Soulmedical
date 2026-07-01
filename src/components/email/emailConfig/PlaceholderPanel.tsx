type Placeholder = { placeholder: string; description: string };

type PlaceholderPanelProps = {
  placeholders: Placeholder[];
  onInsert: (placeholder: string) => void;
};

export default function PlaceholderPanel({ placeholders, onInsert }: PlaceholderPanelProps) {
  if (placeholders.length === 0) {
    return (
      <div className="mb-2.5 rounded-lg border border-slate-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-400">
        No hay campos en el formulario aún
      </div>
    );
  }

  return (
    <div className="mb-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.4px] text-gray-500">
        📋 Campos disponibles — clic para insertar donde está el cursor
      </div>
      <div className="flex flex-wrap gap-1.5">
        {placeholders.map((p, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsert(p.placeholder);
            }}
            title={`Insertar: ${p.description}`}
            className="cursor-pointer rounded-md border-[1.5px] border-[#00c2a8] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-teal-700 transition-colors hover:bg-emerald-50"
          >
            {p.placeholder}
          </button>
        ))}
      </div>
    </div>
  );
}
