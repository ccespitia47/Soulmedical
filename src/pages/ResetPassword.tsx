import { useState } from "react";
import { resetPassword } from "../services/api";
import AuthLayout from "../components/auth/AuthLayout";
import Icon from "../components/common/Icon";

type ResetPasswordProps = {
  token: string;
  onBackToLogin: () => void;
};

// Degradado corporativo (colores del logo)
const BRAND_GRADIENT = "linear-gradient(135deg, #1CB4CE 0%, #127E96 100%)";
const INPUT_CLASS =
  "w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 py-3 pl-[42px] pr-[14px] text-sm text-slate-900 outline-none transition focus:border-[#16A6C0] focus:bg-white focus:ring-2 focus:ring-[#16A6C0]/20";

export default function ResetPassword({ token, onBackToLogin }: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!token) {
      setError("El enlace no tiene token. Solicita un enlace nuevo desde 'Olvidé mi contraseña'.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "El enlace no es válido o expiró. Solicita uno nuevo.");
      return;
    }
    setSuccess(result.data.message);
  };

  return (
    <AuthLayout variant="light">
      <div className="animate-fade-up mb-7 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] text-white shadow-[0_12px_30px_-6px_rgba(22,166,192,0.55)]"
          style={{ background: BRAND_GRADIENT }}
        >
          <Icon name="lock" size={30} />
        </div>
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          SoulForms
        </h1>
      </div>

      <div
        className="animate-fade-up rounded-[20px] border border-white/70 bg-white/70 p-6 shadow-[0_24px_60px_-20px_rgba(15,45,90,0.3)] ring-1 ring-slate-900/[0.03] backdrop-blur-xl sm:p-8"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="m-0 text-xl font-extrabold tracking-tight text-slate-900">
          Nueva contraseña
        </h2>
        <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-slate-500">
          Elige una contraseña segura para tu cuenta.
        </p>

        {success ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[13px] leading-relaxed text-emerald-700">
            <span className="mt-px shrink-0 text-emerald-500">
              <Icon name="checkCircle" size={18} />
            </span>
            <span>{success}</span>
          </div>
        ) : (
          <>
            <div className="mb-3.5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Contraseña nueva
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#0F7C90]">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={`${INPUT_CLASS} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? (
                    <Icon name="eyeOff" size={18} />
                  ) : (
                    <Icon name="eye" size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#0F7C90]">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Repite la contraseña"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-[13px] text-red-600">
            <Icon name="alert" size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!success && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(22,166,192,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-6px_rgba(22,166,192,0.6)] disabled:cursor-not-allowed disabled:shadow-none"
            style={{ background: loading ? "#94a3b8" : BRAND_GRADIENT }}
          >
            {loading ? (
              <>
                <span className="animate-spin-slow inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                Guardando…
              </>
            ) : (
              "Guardar contraseña →"
            )}
          </button>
        )}

        <button
          onClick={onBackToLogin}
          className="mt-3 w-full rounded-lg py-2.5 text-[13px] font-semibold text-[#0F7C90] transition hover:bg-slate-900/[0.03] hover:text-[#127E96]"
        >
          ← Ir al inicio de sesión
        </button>
      </div>
    </AuthLayout>
  );
}
