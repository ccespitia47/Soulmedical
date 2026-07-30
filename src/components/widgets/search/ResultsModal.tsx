type Row = Record<string, unknown>;

export default function ResultsModal({
  results,
  columns,
  onSelect,
  onClose,
  query,
}: {
  results: Row[];
  columns: { key: string; label: string }[];
  onSelect: (row: Row) => void;
  onClose: () => void;
  query: string;
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[80vh] w-full max-w-[700px] flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-gray-900">Resultados de búsqueda</div>
            <div className="text-xs text-gray-500">{results.length} resultado(s) para "{query}"</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 cursor-pointer rounded-lg border-none bg-slate-100 text-slate-500">✕</button>
        </div>
        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
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
                  {columns.map((c) => (
                    <th key={c.key} className="border-b border-slate-200 px-4 py-2.5 text-left text-xs font-bold uppercase text-gray-500">
                      {c.label}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50"
                    onClick={() => onSelect(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-sm text-gray-900">
                        {String(row[c.key] ?? "")}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <button className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-3 py-1 text-xs font-semibold text-white">
                        Seleccionar
                      </button>
                    </td>
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
