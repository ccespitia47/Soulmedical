import { useState } from "react";
import { reset2FAApi } from "../../services/api";

type MyTwoFactorModalProps = {
  onClose: () => void;
};

/**
 * Modal "Mi doble factor" para el usuario logueado. Permite resetear su
 * propio 2FA: borra el TOTP secret tras verificar su contraseña actual.
 * En el siguiente login, el usuario deberá configurar 2FA de nuevo
 * (nuevo QR, nueva app/dispositivo).
 *
 * Uso típico: el usuario cambió de móvil o reinstaló la app authenticator
 * y quiere reconfigurar sin esperar a un admin.
 */
export default function MyTwoFactorModal({ onClose }: MyTwoFactorModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { kind: "ok"; message: string } | { kind: "err"; message: string } | null
  >(null);

  const handleReset = async () => {
    if (!password) {
      setResult({ kind: "err", message: "Ingresa tu contraseña actual." });
      return;
    }
    setBusy(true);
    setResult(null);
    const res = await reset2FAApi(password);
    setBusy(false);
    if (res.error || !res.data) {
      setResult({
        kind: "err",
        message: res.error ?? "No se pudo resetear el 2FA.",
      });
      return;
    }
    setResult({
      kind: "ok",
      message:
        "2FA reiniciado. La próxima vez que ingreses, deberás configurarlo de nuevo.",
    });
    setPassword("");
    setConfirming(false);
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-white px-7 pb-7 pt-6 shadow-[0_24px_60px_rgba(0,40,80,0.3)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-lg text-white">
              🔐
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">
                Mi doble factor
              </div>
              <div className="text-[11.5px] text-slate-500">
                Restablece tu 2FA si cambiaste de dispositivo
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-base text-slate-500"
          >
            ✕
          </button>
        </div>

        <p className="m-0 mb-4 text-[12.5px] leading-relaxed text-slate-600">
          Al restablecer tu doble factor, se borrará el código actual de tu app
          authenticator (Google Authenticator, Authy, etc.). En tu próximo
          inicio de sesión escanearás un código QR nuevo desde el dispositivo
          que quieras usar.
        </p>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
          Tu contraseña actual
        </label>
        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 pr-11 text-sm text-slate-900 outline-none focus:border-[#00c2a8] focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5 text-base text-slate-400"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {result && (
          <div
            className="mb-3 rounded-md border px-3 py-2 text-[12px]"
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
            disabled={busy || !password}
            className="w-full cursor-pointer rounded-[10px] border-[1.5px] border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            🔄 Restablecer mi doble factor
          </button>
        )}

        {confirming && (
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2.5 text-[12px] font-semibold text-amber-900">
              ¿Confirmar? Tu app authenticator actual dejará de servir y
              tendrás que escanear un código nuevo en tu próximo login.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-500 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="cursor-pointer rounded-md border-none bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Reseteando..." : "Sí, restablecer"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[11.5px] font-semibold text-slate-500"
          >
            {result?.kind === "ok" ? "Cerrar" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}
