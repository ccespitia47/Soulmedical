import { cardCls } from "../sections/sharedUi";

// La consulta del historial falló (red, sesión, servidor). Sin este aviso, la ausencia del panel
// "vacunas previas" se leería como "el paciente no tiene vacunas previas".
export default function PatientLookupWarning() {
  return (
    <div role="status" className={`${cardCls} border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20`}>
      <p className="m-0 text-[13px] text-amber-800 dark:text-amber-200">
        <strong className="font-semibold">No se pudo consultar el historial del paciente.</strong> No asumas que no tiene
        vacunas previas: vuelve a escribir el documento para reintentar o verifícalo por otro medio.
      </p>
    </div>
  );
}
