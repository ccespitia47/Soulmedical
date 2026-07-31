import { useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;

type Props = {
  columns: { key: string; label: string }[];
  initialQuery?: string;
  minChars: number;
  onSearch: (q: string) => Promise<Row[]>;
  onSelect: (row: Row) => void;
  onClose: () => void;
};

/**
 * Modal auto-contenido: tiene su propio input de búsqueda con debounce
 * de 300ms. Cada fila se selecciona con un clic (sin botón "Seleccionar").
 * Auto-focus en el input al abrir para escribir sin fricción.
 */
export default function ResultsModal({
  columns,
  initialQuery = "",
  minChars,
  onSearch,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auto-focus al montar
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.length < minChars) { setResults([]); return; }
      setLoading(true);
      try { setResults(await onSearch(query)); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, minChars, onSearch]);

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const displayCols =
    columns.length > 0
      ? columns
      : [{ key: Object.keys(results[0] ?? {})[0] ?? "value", label: "Resultado" }];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[80vh] w-full max-w-[720px] flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con input de búsqueda */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-bold text-gray-900">🔍 Buscar</div>
            <button
              onClick={onClose}
              className="h-8 w-8 cursor-pointer rounded-lg border-none bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={`Escribe al menos ${minChars} caracter${minChars === 1 ? "" : "es"}...`}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 pr-10 text-[14px] outline-none focus:border-[#00c2a8]"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">⏳</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-400">
            {query.length < minChars
              ? `Escribe al menos ${minChars} caracter${minChars === 1 ? "" : "es"} para buscar`
              : `${results.length} resultado${results.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="flex-1 overflow-auto">
          {query.length < minChars ? (
            <div className="flex h-full items-center justify-center text-gray-300">
              <div className="text-center">
                <div className="mb-2 text-5xl">✍️</div>
                <p className="text-sm">Empieza a escribir…</p>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">🔍</div>
                <p>No se encontraron resultados</p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {displayCols.map((c) => (
                    <th
                      key={c.key}
                      className="border-b border-slate-200 px-4 py-2.5 text-left text-xs font-bold uppercase text-gray-500"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr
                    key={i}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-emerald-50"
                    onClick={() => onSelect(row)}
                  >
                    {displayCols.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-sm text-gray-900">
                        {String(row[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
