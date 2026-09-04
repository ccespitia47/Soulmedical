import { useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;

type Props = {
  columns: { key: string; label: string }[];
  /** Cuando `columns` está vacío, usar este key como columna única.
   *  Si no se provee, se toma la primera key con valor no vacío del row. */
  fallbackKey?: string;
  initialQuery?: string;
  minChars: number;
  onSearch: (q: string) => Promise<Row[]>;
  onSelect: (row: Row) => void;
  onClose: () => void;
};

// Cantidad de registros a mostrar como preview inicial (q="").
const PREVIEW_LIMIT = 50;

/**
 * Modal auto-contenido: al abrir dispara onSearch("") para mostrar los
 * primeros PREVIEW_LIMIT registros sin filtrar. Al escribir, filtra con
 * debounce de 300ms (comportamiento previo). Auto-focus en el input al abrir.
 */
export default function ResultsModal({
  columns,
  fallbackKey,
  initialQuery = "",
  minChars,
  onSearch,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
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
      const q = query.trim();
      // 3 casos:
      // - q === ""             → preview inicial (source devuelve primeros N)
      // - q y q.length < minChars → mantener lo anterior visible (no re-buscar)
      // - q.length >= minChars → búsqueda real
      if (q !== "" && q.length < minChars) {
        // No cambia results — deja lo que había (preview o última búsqueda).
        return;
      }
      setLoading(true);
      setIsPreview(q === "");
      try { setResults(await onSearch(q)); }
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

  // Fallback: si no hay columns configuradas, mostrar hasta 5 columnas con
  // las keys que tengan valor no vacío en al menos un row.
  const nonEmptyKeys = (): string[] => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of results) {
      for (const [k, v] of Object.entries(row)) {
        if (seen.has(k)) continue;
        if (v != null && String(v).trim() !== "") {
          seen.add(k);
          order.push(k);
        }
      }
    }
    return order;
  };
  const buildFallbackCols = () => {
    const keys = nonEmptyKeys();
    if (fallbackKey && keys.includes(fallbackKey)) {
      const rest = keys.filter((k) => k !== fallbackKey);
      return [fallbackKey, ...rest].slice(0, 5).map((k) => ({ key: k, label: k }));
    }
    return keys.slice(0, 5).map((k) => ({ key: k, label: k }));
  };
  const fallbackCols = buildFallbackCols();
  const displayCols =
    columns.length > 0
      ? columns
      : fallbackCols.length > 0
      ? fallbackCols
      : [{ key: "value", label: "Resultado" }];

  const q = query.trim();
  const hintText =
    q === ""
      ? `Mostrando primeros ${PREVIEW_LIMIT} — escribe para filtrar`
      : q.length < minChars
      ? `Escribe al menos ${minChars} caracter${minChars === 1 ? "" : "es"} para buscar`
      : `${results.length} resultado${results.length === 1 ? "" : "s"}`;

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
              placeholder="Escribe para filtrar..."
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 pr-10 text-[14px] outline-none focus:border-[#00c2a8]"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">⏳</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-400">{hintText}</div>
        </div>

        {/* Tabla de resultados (preview inicial o búsqueda) */}
        <div className="flex-1 overflow-auto">
          {loading && results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">⏳</div>
                <p className="text-sm">Cargando…</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">🔍</div>
                <p>{isPreview ? "Sin registros" : "No se encontraron resultados"}</p>
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
