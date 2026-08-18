import { sanitizeHtml } from "../../utils/sanitize";

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Deshabilita ambos botones mientras dura la acción confirmada (p.ej.
   * durante el fetch del backend). Previene doble-click. */
  busy?: boolean;
};

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor,
  onCancel,
  onConfirm,
  busy = false,
}: ConfirmModalProps) {
  const icon = confirmColor === "#ef4444" ? "🗑️" : "📋";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(135deg, ${confirmColor}, ${confirmColor}cc)`,
          }}
        >
          <span className="text-[32px]">{icon}</span>
        </div>
        <h2 className="m-0 mb-3 text-xl font-bold text-gray-900">{title}</h2>
        <p
          className="m-0 mb-6 text-sm leading-relaxed text-gray-500"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message) }}
        />
        <div className="flex justify-center gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-6 py-2.5 text-sm font-semibold text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="cursor-pointer rounded-lg border-none px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
