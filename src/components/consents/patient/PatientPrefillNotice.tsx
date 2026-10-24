import { cardCls, labelCls } from "../sections/sharedUi";

// Aviso del autorrelleno: dice DE QUIÉN y de CUÁNDO vienen los datos y permite deshacer.

type Props = {
  aviso: { fecha: string; nombre: string };
  onUndo: () => void;
};

export default function PatientPrefillNotice({ aviso, onUndo }: Props) {
  return (
    <div role="status" className={`${cardCls} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <span className={labelCls}>Datos completados automáticamente</span>
        <p className="m-0 text-[13px] text-slate-600 dark:text-slate-300">
          Tomados del consentimiento de{" "}
          <strong className="font-semibold">{aviso.nombre || "paciente sin nombre"}</strong> del {aviso.fecha}. Revísalos antes de continuar.
        </p>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        Deshacer
      </button>
    </div>
  );
}
