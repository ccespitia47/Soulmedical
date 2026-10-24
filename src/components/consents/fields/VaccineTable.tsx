import { useEffect, useMemo, useRef, useState } from "react";
import type { VaccineTableColumn } from "../config/entityConfig";
import {
  CATALOGO,
  OTRA_LABEL,
  calcularProxima,
  findEntry,
  ES_ISO,
  isoADmy,
  nombreVacuna,
  parseDosis,
  siguienteDosisLabel,
} from "../vaccines/vaccineSchedule";
import type { VacunaPrevia } from "../patient/usePatientLookup";

type Row = Record<string, string>;
type Elegida = { nombre: string; dosis: string };
type EsquemaEntry = NonNullable<ReturnType<typeof findEntry>>;

type Props = {
  columns: VaccineTableColumn[];
  /** Emite las filas no vacías como JSON legible. */
  onChange: (json: string) => void;
  /** Filas ya existentes (modo edición, Task 6): solo se usan como valor
   *  inicial al montar, igual que el resto del componente es "no controlado". */
  initialRows?: Row[];
  /** Vacunas previas del paciente: solo alimentan la sugerencia y el cálculo, no el estado de las filas. */
  historial?: VacunaPrevia[];
  /** Documento al que pertenece `historial` (null = ninguno vigente). Al cambiar, las filas elegidas desde una
   *  sugerencia se limpian: lo que hay en el formulario corresponde siempre al documento en pantalla. */
  historialDoc?: string | null;
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
    .filter((h) => norm(h.vacuna) === vacuna.toUpperCase() && parseDosis(h.dosis) === 1 && ES_ISO.test(h.aplicada))
    .map((h) => h.aplicada)
    .sort();
  // Si el esquema se reinició, la serie vigente empieza en la dosis 1 más reciente.
  return fechas[fechas.length - 1] ?? "";
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

export default function VaccineTable({ columns, onChange, initialRows, historial = [], historialDoc = null, fechaConsentimiento = "" }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length ? initialRows : [emptyRow(columns)],
  );
  // Filas en texto libre ("Otra"): paralelo a `rows`. Una fila guardada con un nombre
  // que no está en el catálogo (p. ej. datos anteriores) arranca como texto libre.
  const [libre, setLibre] = useState<boolean[]>(() =>
    rows.map((r) => (r.nombre ?? "") !== "" && !findEntry(r.nombre)),
  );

  // Filas cuya `proxima` calculó el componente (no la tecleó el profesional): se recalculan
  // si cambia la fecha del consentimiento; una edición manual la saca de aquí.
  const [derivada, setDerivada] = useState<boolean[]>(() => rows.map(() => false));

  // Filas cuyo nombre/dosis se eligieron desde una entrada "· sugerida" (basada en el historial de un
  // documento): paralelo a `rows`. Guarda lo elegido para revertir solo lo que sigue siendo eso.
  const [sugerida, setSugerida] = useState<(Elegida | null)[]>(() => rows.map(() => null));
  const [revertida, setRevertida] = useState(false);
  const docPrevio = useRef(historialDoc);

  const proximaDe = (entry: EsquemaEntry, base: string) => isoADmy(calcularProxima(entry, base));

  const baseDe = (entry: EsquemaEntry) =>
    entry.dosis === "1" ? fechaConsentimiento : fechaDosis1(historial, entry.vacuna);

  useEffect(() => {
    let cambio = false;
    let actuales = rows;
    let der = derivada;

    // Cambió el documento: lo elegido desde una sugerencia ya no corresponde a quien está en pantalla.
    if (docPrevio.current !== historialDoc) {
      docPrevio.current = historialDoc;
      if (sugerida.some(Boolean)) {
        const lib = [...libre];
        der = [...derivada];
        actuales = rows.map((r, i) => {
          const s = sugerida[i];
          if (!s) return r;
          lib[i] = false;
          der[i] = false;
          if (r.nombre !== s.nombre) return r; // el profesional ya la cambió: es suya
          return {
            ...r,
            nombre: "",
            dosis: r.dosis === s.dosis ? "" : r.dosis,
            proxima: derivada[i] ? "" : r.proxima,
          };
        });
        setLibre(lib);
        setDerivada(der);
        setSugerida(sugerida.map(() => null));
        setRevertida(true);
        cambio = true;
      }
    }

    const next = actuales.map((r, i) => {
      const entry = der[i] ? findEntry(r.nombre ?? "") : undefined;
      if (!entry) return r;
      const proxima = proximaDe(entry, baseDe(entry));
      if (proxima === r.proxima) return r;
      cambio = true;
      return { ...r, proxima };
    });
    if (cambio) {
      setRows(next);
      emit(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaConsentimiento, historial, historialDoc, rows, derivada]);

  const sug = useMemo(() => sugeridas(historial), [historial]);
  const opciones = useMemo(() => {
    const entradas = [...sug, ...CATALOGO.map((e) => e.label).filter((l) => !sug.includes(l))];
    return entradas.map((label) => ({ label, texto: sug.includes(label) ? `${label} · sugerida` : label }));
  }, [sug]);

  const elegir = (i: number, value: string) => {
    const entry = findEntry(value);
    setLibre((l) => l.map((x, idx) => (idx === i ? value === OTRA_LABEL : x)));
    setDerivada((d) => d.map((x, idx) => (idx === i ? !!entry : x)));
    setSugerida((g) => g.map((x, idx) => (idx === i ? (entry && sug.includes(entry.label) ? { nombre: entry.label, dosis: entry.dosis } : null) : x)));
    setRevertida(false);
    // Cambiar de vacuna descarta dosis y próxima de la anterior (también al pasar a "Otra" o a vacío).
    const next = rows.map((r, idx) =>
      idx !== i
        ? r
        : entry
          ? { ...r, nombre: entry.label, dosis: entry.dosis, proxima: proximaDe(entry, baseDe(entry)) }
          : { ...r, nombre: "", dosis: "", proxima: "" },
    );
    setRows(next);
    emit(next);
  };

  const emit = (next: Row[]) => {
    const filled = next.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
    onChange(filled.length ? JSON.stringify(filled) : "");
  };

  const setCell = (i: number, colId: string, v: string) => {
    if (colId === "proxima") setDerivada((d) => d.map((x, idx) => (idx === i ? false : x)));
    const next = rows.map((r, idx) => (idx === i ? { ...r, [colId]: v } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => {
    setRows((r) => [...r, emptyRow(columns)]);
    setLibre((l) => [...l, false]);
    setDerivada((d) => [...d, false]);
    setSugerida((g) => [...g, null]);
  };
  const removeRow = (i: number) => {
    setLibre((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : [false]));
    setDerivada((d) => (d.length > 1 ? d.filter((_, idx) => idx !== i) : [false]));
    setSugerida((g) => (g.length > 1 ? g.filter((_, idx) => idx !== i) : [null]));
    const next = rows.filter((_, idx) => idx !== i);
    const safe = next.length ? next : [emptyRow(columns)];
    setRows(safe);
    emit(safe);
  };

  return (
    <div>
      {revertida && (
        <p role="status" className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Cambió el documento del paciente: se quitó la vacuna que se había elegido como sugerida. Vuelve a elegirla si corresponde.
        </p>
      )}
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
