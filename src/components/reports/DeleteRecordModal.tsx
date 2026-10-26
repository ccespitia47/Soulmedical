import { useState } from "react";
import Icon from "../common/Icon";

type Props = {
  recordId: string;
  recordLabel: string;
  onCancel: () => void;
  /** Devuelve `null` si el borrado tuvo éxito, string con el mensaje de error si falló. */
  onConfirm: (reason: string) => Promise<string | null>;
};

const MIN = 5;
const MAX = 300;

/**
 * Modal para eliminar un registro exigiendo un motivo escrito (auditoría).
 * El motivo se envía al backend en el body del DELETE y queda guardado en
 * admin_actions.metadata.reason para el reporte de acciones.
 */
export default function DeleteRecordModal({
  recordId,
  recordLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN;
  const tooLong = trimmed.length > MAX;
  const canSubmit = trimmed.length >= MIN && !tooLong && !busy;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const errMsg = await onConfirm(trimmed);
    setBusy(false);
    if (errMsg) setError(errMsg);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Icon name="alert" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-lg font-bold text-gray-900">
              Eliminar registro
            </h2>
            <p className="m-0 mt-0.5 text-[12.5px] text-gray-500">
              Esta acción no se puede deshacer. Se registrará en el reporte de
              acciones con el motivo indicado.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          <div>
            <span className="font-semibold text-slate-500">Registro:</span>{" "}
            <span className="font-mono text-[11px] text-slate-800">{recordId}</span>
          </div>
          {recordLabel && (
            <div className="mt-1 truncate">
              <span className="font-semibold text-slate-500">Usuario:</span>{" "}
              {recordLabel}
            </div>
          )}
        </div>

        <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">
          Motivo de eliminación <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: registro duplicado, datos incorrectos, solicitud del paciente…"
          rows={4}
          maxLength={MAX + 20}
          className={`w-full resize-y rounded-lg border-[1.5px] px-3 py-2 text-[13px] text-gray-900 outline-none transition focus:ring-2 focus:ring-red-500/20 ${
            tooShort || tooLong
              ? "border-red-300 focus:border-red-500"
              : "border-slate-200 focus:border-red-500"
          }`}
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span
            className={
              tooShort
                ? "text-red-600"
                : tooLong
                  ? "text-red-600"
                  : "text-slate-400"
            }
          >
            {tooShort
              ? `Mínimo ${MIN} caracteres`
              : tooLong
                ? `Máximo ${MAX} caracteres`
                : `Mínimo ${MIN} caracteres — se guarda en la auditoría`}
          </span>
          <span
            className={
              tooLong
                ? "font-semibold text-red-600 tabular-nums"
                : "text-slate-400 tabular-nums"
            }
          >
            {trimmed.length}/{MAX}
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <Icon name="alert" size={14} className="mt-px flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="cursor-pointer rounded-lg border-none bg-red-600 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Eliminando…" : "Eliminar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
