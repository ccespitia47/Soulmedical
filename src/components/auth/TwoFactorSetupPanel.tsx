import { useEffect, useRef, useState } from "react";
import {
  start2FASetupApi,
  confirm2FASetupApi,
  type LoginFinalResponse,
} from "../../services/api";

type TwoFactorSetupPanelProps = {
  setupToken: string;
  /** Color/gradiente del botón principal — Soul (teal) o Consientify (sky). */
  accent?: string;
  gradient?: string;
  shadow?: string;
  /** Llamado cuando el setup se completa con éxito y el backend entrega el JWT. */
  onSuccess: (result: LoginFinalResponse) => void;
  onCancel?: () => void;
};

/**
 * Setup obligatorio del 2FA: muestra solo el QR y el input de código.
 * Al confirmar el primer código válido, el backend activa totpEnabled
 * y devuelve el JWT final.
 */
export default function TwoFactorSetupPanel({
  setupToken,
  accent = "#00c2a8",
  gradient = "linear-gradient(135deg,#00c2a8,#0891b2)",
  shadow = "rgba(0,194,168,0.35)",
  onSuccess,
  onCancel,
}: TwoFactorSetupPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);

  // Pedimos el QR una sola vez al montar. Guard contra StrictMode (doble mount en dev)
  // — sin él, en dev se llama 2 veces y el backend regenera el secret la 2da vez.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const res = await start2FASetupApi(setupToken);
      if (res.error || !res.data) {
        setError(res.error ?? "No se pudo generar el código QR.");
        setLoading(false);
        return;
      }
      setQrDataUrl(res.data.qrDataUrl);
      setLoading(false);
      setTimeout(() => codeInputRef.current?.focus(), 50);
    })();
  }, [setupToken]);

  const handleVerify = async () => {
    if (verifying) return;
    const cleaned = code.replace(/\s+/g, "");
    if (cleaned.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setError("");
    setVerifying(true);
    const res = await confirm2FASetupApi(setupToken, cleaned);
    setVerifying(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Código incorrecto. Vuelve a intentar.");
      setCode("");
      codeInputRef.current?.focus();
      return;
    }
    onSuccess(res.data);
  };

  return (
    <div>
      <div className="mb-4 text-center">
        <div className="mb-1 text-base font-bold text-slate-900">
          🔐 Configura tu doble factor
        </div>
        <p className="m-0 text-[12.5px] leading-relaxed text-slate-500">
          Escanea el código con tu app authenticator (Google Authenticator,
          Authy, Microsoft Authenticator, 1Password…) y luego ingresa el código
          de 6 dígitos que aparece para confirmar.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <span className="animate-spin-slow inline-block mr-2 h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600" />
          Generando QR…
        </div>
      )}

      {!loading && qrDataUrl && (
        <>
          <div className="mb-3 flex justify-center">
            <img
              src={qrDataUrl}
              alt="Código QR para configurar 2FA"
              className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
            />
          </div>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
            Código de 6 dígitos
          </label>
          <input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="000000"
            className="mb-4 w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 text-center font-mono text-[20px] tracking-[0.5em] text-slate-900 outline-none focus:border-current focus:bg-white"
            style={{ color: accent }}
          />

          {error && (
            <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: verifying ? "#94a3b8" : gradient,
              boxShadow: verifying ? "none" : `0 4px 16px ${shadow}`,
            }}
          >
            {verifying ? "Verificando…" : "Activar doble factor →"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 w-full cursor-pointer rounded-[10px] border-none bg-transparent py-2 text-xs font-semibold text-slate-500"
            >
              Cancelar
            </button>
          )}
        </>
      )}

      {!loading && !qrDataUrl && error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
