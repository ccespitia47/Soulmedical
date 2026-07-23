import { useEffect, useRef, useState } from "react";
import { verifyLogin2FAApi, type LoginFinalResponse } from "../../services/api";

type TwoFactorCodePanelProps = {
  pendingToken: string;
  accent?: string;
  gradient?: string;
  shadow?: string;
  onSuccess: (result: LoginFinalResponse) => void;
  onCancel?: () => void;
};

/**
 * Segundo paso del login cuando el usuario YA tiene 2FA activo.
 * Solo pide el código de 6 dígitos.
 */
export default function TwoFactorCodePanel({
  pendingToken,
  accent = "#00c2a8",
  gradient = "linear-gradient(135deg,#00c2a8,#0891b2)",
  shadow = "rgba(0,194,168,0.35)",
  onSuccess,
  onCancel,
}: TwoFactorCodePanelProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const handleVerify = async () => {
    if (verifying) return;
    const cleaned = code.replace(/\s+/g, "");
    if (cleaned.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setError("");
    setVerifying(true);
    const res = await verifyLogin2FAApi(pendingToken, cleaned);
    setVerifying(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Código incorrecto.");
      setCode("");
      inputRef.current?.focus();
      return;
    }
    onSuccess(res.data);
  };

  return (
    <div>
      <div className="mb-5 text-center">
        <div className="mb-1 text-base font-bold text-slate-900">
          🔐 Verificación en dos pasos
        </div>
        <p className="m-0 text-[12.5px] leading-relaxed text-slate-500">
          Ingresa el código de 6 dígitos que muestra tu app authenticator.
        </p>
      </div>

      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
        Código de 6 dígitos
      </label>
      <input
        ref={inputRef}
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
        {verifying ? "Verificando…" : "Verificar →"}
      </button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full cursor-pointer rounded-[10px] border-none bg-transparent py-2 text-xs font-semibold text-slate-500"
        >
          Volver
        </button>
      )}
    </div>
  );
}
