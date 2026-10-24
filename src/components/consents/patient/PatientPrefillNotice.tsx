// Aviso del autorrelleno: dice DE QUIÉN y de CUÁNDO vienen los datos y permite deshacer.

type Props = {
  aviso: { fecha: string; nombre: string };
  onUndo: () => void;
};

export default function PatientPrefillNotice({ aviso, onUndo }: Props) {
  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#00c2a8]/40 bg-[#00c2a8]/5 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2dd4bf]/30 dark:bg-[#2dd4bf]/10"
    >
      <p className="m-0 text-[13px] text-slate-700 dark:text-slate-200">
        Datos completados desde el consentimiento de{" "}
        <strong className="font-semibold">{aviso.nombre || "paciente sin nombre"}</strong> del {aviso.fecha}. Revísalos antes de continuar.
      </p>
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
