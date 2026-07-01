export type EmailStatus = "idle" | "sending" | "sent" | "error";

type SuccessModalProps = {
  emailStatus: EmailStatus;
  emailError: string | null;
  onNewRegistration: () => void;
  onClose?: () => void;
};

export default function SuccessModal({
  emailStatus,
  emailError,
  onNewRegistration,
  onClose,
}: SuccessModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white px-10 py-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_8px_24px_rgba(16,185,129,0.4)]">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="m-0 mb-2.5 text-[22px] font-bold text-gray-900">¡Registro guardado!</h2>
        <p className="m-0 mb-4 text-sm leading-relaxed text-gray-500">
          El formulario fue enviado correctamente.
        </p>

        {emailStatus === "sending" && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-800">
            📧 Enviando notificación por email...
          </div>
        )}
        {emailStatus === "sent" && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800">
            ✅ Notificación enviada correctamente
          </div>
        )}
        {emailStatus === "error" && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-900">
            ⚠️ El registro se guardó pero el email no pudo enviarse
            {emailError && <div className="mt-1 text-[11px] opacity-85">{emailError}</div>}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onNewRegistration}
            className="cursor-pointer rounded-[10px] border-none bg-[#00c2a8] px-8 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,194,168,0.3)]"
          >
            📋 Diligenciar otro registro
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="cursor-pointer rounded-[10px] border-[1.5px] border-slate-200 bg-transparent px-8 py-2.5 text-sm font-semibold text-gray-500"
            >
              Volver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
