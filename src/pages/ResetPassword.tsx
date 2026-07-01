import { useState } from "react";
import { resetPassword } from "../services/api";
import AuthLayout from "../components/auth/AuthLayout";

type ResetPasswordProps = {
  token: string;
  onBackToLogin: () => void;
};

const BRAND_GRADIENT = "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)";
const INPUT_CLASS =
  "w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 pl-[42px] text-sm text-slate-900 outline-none";

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
    <AuthLayout>
      <div className="mb-7 text-center">
        <div
          className="mb-3.5 inline-flex h-16 w-16 items-center justify-center rounded-[20px] shadow-[0_8px_32px_rgba(0,194,168,0.45)]"
          style={{ background: BRAND_GRADIENT }}
        >
          <span className="text-[32px]">🏥</span>
        </div>
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">
          SoulForms
        </h1>
      </div>

      <div className="rounded-[20px] border border-white/70 bg-white/[0.88] px-9 pb-8 pt-9 shadow-[0_24px_60px_rgba(0,40,80,0.22),0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-2xl">
        <h2 className="m-0 mb-1 text-xl font-bold text-slate-900">Nueva contraseña</h2>
        <p className="mb-6 mt-0 text-[13px] text-slate-500">
          Elige una contraseña segura para tu cuenta.
        </p>

        {success ? (
          <div className="mb-4 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[13px] leading-relaxed text-emerald-800">
            ✅ {success}
          </div>
        ) : (
          <>
            <div className="mb-3.5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Contraseña nueva
              </label>
              <div className="relative">
                <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-base">🔒</div>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-base text-slate-400"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-base">🔒</div>
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {!success && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed"
            style={{
              background: loading ? "#94a3b8" : BRAND_GRADIENT,
              boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
            }}
          >
            {loading ? "Guardando..." : "Guardar contraseña →"}
          </button>
        )}

        <button
          onClick={onBackToLogin}
          className="mt-3 w-full p-2.5 text-[13px] font-semibold text-cyan-700"
        >
          ← Ir al inicio de sesión
        </button>
      </div>
    </AuthLayout>
  );
}
