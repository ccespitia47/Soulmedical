import { useMemo, useState } from "react";
import type { VaccineTableColumn } from "../config/entityConfig";
import {
  CATALOGO,
  OTRA_LABEL,
  calcularProxima,
  findEntry,
  nombreVacuna,
  siguienteDosisLabel,
} from "../vaccines/vaccineSchedule";
import type { VacunaPrevia } from "../patient/usePatientLookup";

type Row = Record<string, string>;

type Props = {
  columns: VaccineTableColumn[];
  /** Emite las filas no vacías como JSON legible. */
  onChange: (json: string) => void;
  /** Filas ya existentes (modo edición, Task 6): solo se usan como valor
   *  inicial al montar, igual que el resto del componente es "no controlado". */
  initialRows?: Row[];
  /** Vacunas previas del paciente: solo alimentan la sugerencia y el cálculo, no el estado de las filas. */
  historial?: VacunaPrevia[];
  /** Fecha del consentimiento (ISO): base del cálculo cuando se elige una dosis 1. */
  fechaConsentimiento?: string;
};

const emptyRow = (columns: VaccineTableColumn[]): Row =>
  Object.fromEntries(columns.map((c) => [c.id, ""]));

// El reinicio se hace desde el padre remontando el componente con una `key`
// distinta (ver SectionC), por lo que el estado interno vuelve a su inicial.
const norm = (s: string) => nombreVacuna(s).trim().toUpperCase();

/** Fecha de la dosis 1 de esa vacuna según el historial ("" si no hay registro). */
function fechaDosis1(historial: VacunaPrevia[], vacuna: string): string {
  const fechas = historial
    .filter((h) => norm(h.vacuna) === vacuna.toUpperCase() && parseInt(h.dosis, 10) === 1 && h.aplicada)
    .map((h) => h.aplicada)
    .sort();
  return fechas[0] ?? "";
}

/** Entradas sugeridas (siguiente dosis por cada vacuna del esquema ya registrada en el historial). */
function sugeridas(historial: VacunaPrevia[]): string[] {
  const out: string[] = [];
  for (const vacuna of new Set(CATALOGO.map((e) => e.vacuna))) {
    const propias = historial.filter((h) => norm(h.vacuna) === vacuna.toUpperCase());
    if (!propias.length) continue;
    const label = siguienteDosisLabel(vacuna, propias.map((h) => h.dosis));
    if (label) out.push(label);
  }
  return out;
}

const fieldCls =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default function VaccineTable({ columns, onChange, initialRows, historial = [], fechaConsentimiento = "" }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length ? initialRows : [emptyRow(columns)],
  );
  // Filas en texto libre ("Otra"): paralelo a `rows`. Una fila guardada con un nombre
  // que no está en el catálogo (p. ej. datos anteriores) arranca como texto libre.
  const [libre, setLibre] = useState<boolean[]>(() =>
    rows.map((r) => (r.nombre ?? "") !== "" && !findEntry(r.nombre)),
  );

  const opciones = useMemo(() => {
    const sug = sugeridas(historial);
    const entradas = [...sug, ...CATALOGO.map((e) => e.label).filter((l) => !sug.includes(l))];
    return entradas.map((label) => ({ label, texto: sug.includes(label) ? `${label} · sugerida` : label }));
  }, [historial]);

  const elegir = (i: number, value: string) => {
    if (value === OTRA_LABEL) {
      setLibre((l) => l.map((x, idx) => (idx === i ? true : x)));
      setCell(i, "nombre", "");
      return;
    }
    setLibre((l) => l.map((x, idx) => (idx === i ? false : x)));
    const entry = findEntry(value);
    if (!entry) {
      setCell(i, "nombre", "");
      return;
    }
    const base = entry.dosis === "1" ? fechaConsentimiento : fechaDosis1(historial, entry.vacuna);
    const next = rows.map((r, idx) =>
      idx === i ? { ...r, nombre: entry.label, dosis: entry.dosis, proxima: calcularProxima(entry, base) } : r,
    );
    setRows(next);
    emit(next);
  };

  const emit = (next: Row[]) => {
    const filled = next.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
    onChange(filled.length ? JSON.stringify(filled) : "");
  };

  const setCell = (i: number, colId: string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => {
    setRows((r) => [...r, emptyRow(columns)]);
    setLibre((l) => [...l, false]);
  };
  const removeRow = (i: number) => {
    setLibre((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : [false]));
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
                    {c.id === "nombre" ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`${c.label}, fila ${i + 1}`}
                          value={libre[i] ? OTRA_LABEL : findEntry(row.nombre ?? "") ? row.nombre : ""}
                          onChange={(e) => elegir(i, e.target.value)}
                          className={fieldCls}
                        >
                          <option value="">Seleccionar…</option>
                          {opciones.map((o) => (
                            <option key={o.label} value={o.label}>{o.texto}</option>
                          ))}
                          <option value={OTRA_LABEL}>{OTRA_LABEL}</option>
                        </select>
                        {libre[i] && (
                          <input
                            type="text"
                            aria-label={`Nombre de la vacuna, fila ${i + 1}`}
                            value={row.nombre ?? ""}
                            onChange={(e) => setCell(i, "nombre", e.target.value)}
                            className={fieldCls}
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        aria-label={`${c.label}, fila ${i + 1}`}
                        value={row[c.id]}
                        onChange={(e) => setCell(i, c.id, e.target.value)}
                        className={fieldCls}
                      />
                    )}
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
