import { useState } from "react";
import type { VaccineTableColumn } from "../config/entityConfig";

type Row = Record<string, string>;

type Props = {
  columns: VaccineTableColumn[];
  /** Emite las filas no vacías como JSON legible. */
  onChange: (json: string) => void;
};

const emptyRow = (columns: VaccineTableColumn[]): Row =>
  Object.fromEntries(columns.map((c) => [c.id, ""]));

// El reinicio se hace desde el padre remontando el componente con una `key`
// distinta (ver SectionC), por lo que el estado interno vuelve a su inicial.
export default function VaccineTable({ columns, onChange }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow(columns)]);

  const emit = (next: Row[]) => {
    const filled = next.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
    onChange(filled.length ? JSON.stringify(filled) : "");
  };

  const setCell = (i: number, colId: string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => setRows((r) => [...r, emptyRow(columns)]);
  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    const safe = next.length ? next : [emptyRow(columns)];
    setRows(safe);
    emit(safe);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              {columns.map((c) => (
                <th key={c.id} className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {c.label}
                </th>
              ))}
              <th className="border-b border-slate-200 px-2 py-2 dark:border-slate-700" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.id} className="border-b border-slate-100 px-1.5 py-1.5 dark:border-slate-700">
                    <input
                      type="text"
                      value={row[c.id]}
                      onChange={(e) => setCell(i, c.id, e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </td>
                ))}
                <td className="border-b border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded px-2 py-1 text-slate-400 hover:text-red-500"
                    aria-label="Eliminar fila"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 rounded-md border-[1.5px] border-[#00c2a8] bg-transparent px-4 py-1.5 text-[13px] font-medium text-[#00c2a8] transition-colors hover:bg-[#00c2a8]/5"
      >
        + Agregar vacuna
      </button>
    </div>
  );
}
