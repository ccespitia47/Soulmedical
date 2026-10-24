// Panel plegable (abierto por defecto) con las vacunas ya registradas del
// paciente, para que el profesional pueda contradecir con criterio la dosis
// sugerida en la Sección C. La fila vencida (próxima ya pasada) va en ámbar.

import { cardCls, sectionTitleCls } from "../sections/sharedUi";
import type { VacunaPrevia } from "./usePatientLookup";

/** yyyy-mm-dd → dd/mm/yyyy; vacío o con otro formato → "—" / tal cual. */
function fmt(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const thCls = "px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const tdCls = "px-2 py-1.5 text-[13px] text-slate-700 dark:text-slate-200";

export default function PatientHistoryPanel({ historial }: { historial: VacunaPrevia[] }) {
  if (historial.length === 0) return null;
  return (
    <details open className={cardCls}>
      <summary className={`${sectionTitleCls} cursor-pointer select-none`}>
        Vacunas previas del paciente ({historial.length})
      </summary>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className={thCls}>Vacuna</th>
              <th className={thCls}>Dosis</th>
              <th className={thCls}>Aplicada</th>
              <th className={thCls}>Próxima</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((v, i) => (
              <tr key={`${v.vacuna}-${v.dosis}-${v.aplicada}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className={tdCls}>{v.vacuna}</td>
                <td className={tdCls}>{v.dosis}</td>
                <td className={tdCls}>{fmt(v.aplicada)}</td>
                <td
                  className={`${tdCls} ${v.vencida ? "font-semibold !text-amber-600 dark:!text-amber-400" : ""}`}
                >
                  {fmt(v.proxima)}
                  {v.vencida && " · toca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
