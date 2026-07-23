import { useState } from "react";
import { adminResetUser2faApi, type UserApiData } from "../../services/api";

type TwoFactorAdminPanelProps = {
  user: UserApiData;
  /** Llamado tras reset exitoso para refrescar la lista en la página padre. */
  onReset?: () => void;
};

/**
 * Panel administrativo del 2FA del usuario. Muestra el estado y permite al
 * admin forzar el reset (caso típico: el usuario perdió el dispositivo y
 * no puede ingresar para resetear por sí mismo).
 *
 * Confirmación inline (sin modal anidado) para evitar problemas de z-index
 * con el modal de usuario que lo contiene.
 */
export default function TwoFactorAdminPanel({
  user,
  onReset,
}: TwoFactorAdminPanelProps) {
  const enabled = !!user.totpEnabled;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { kind: "ok"; message: string } | { kind: "err"; message: string } | null
  >(null);

  const handleReset = async () => {
    setBusy(true);
    setResult(null);
    const res = await adminResetUser2faApi(user.id);
    setBusy(false);
    if (res.error || !res.data) {
      setResult({ kind: "err", message: res.error ?? "No se pudo resetear." });
      return;
    }
    setResult({
      kind: "ok",
      message:
        "Doble factor reiniciado. El usuario debera configurarlo de nuevo al ingresar.",
    });
    setConfirming(false);
    onReset?.();
  };

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🔐</span>
          <span className="text-[13px] font-semibold text-gray-900">
            Doble factor de autenticación
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: enabled ? "#d1fae5" : "#f3f4f6",
            color: enabled ? "#065f46" : "#6b7280",
          }}
        >
          {enabled ? "✓ Activo" : "Sin configurar"}
        </span>
      </div>

      <p className="m-0 mb-3 text-[11.5px] leading-relaxed text-gray-500">
        {enabled
          ? "El usuario tiene 2FA configurado. Si perdió el dispositivo, restablécelo para que pueda configurarlo de nuevo al ingresar."
          : "El usuario aún no ha completado el setup de 2FA. Lo hará en su próximo login."}
      </p>

      {result && (
        <div
          className="mb-2 rounded-md border px-2.5 py-1.5 text-[11.5px]"
          style={{
            borderColor: result.kind === "ok" ? "#a7f3d0" : "#fecaca",
            background: result.kind === "ok" ? "#ecfdf5" : "#fef2f2",
            color: result.kind === "ok" ? "#065f46" : "#b91c1c",
          }}
        >
          {result.kind === "ok" ? "✓" : "⚠️"} {result.message}
        </div>
      )}

      {!confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="cursor-pointer rounded-md border-[1.5px] border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          🔄 Restablecer 2FA
        </button>
      )}

      {confirming && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
          <div className="mb-2 text-[11.5px] font-semibold text-amber-900">
            ¿Confirmar reset? Esto borra el secret TOTP del usuario y le
            obligará a configurar 2FA otra vez en su próximo login.
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-1 text-[11.5px] font-semibold text-gray-500 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              className="cursor-pointer rounded-md border-none bg-red-600 px-3 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Reseteando..." : "Sí, restablecer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
