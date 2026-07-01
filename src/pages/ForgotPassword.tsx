import { useState } from "react";
import { forgotPassword } from "../services/api";
import AuthLayout from "../components/auth/AuthLayout";

type ForgotPasswordProps = {
  onBackToLogin: () => void;
};

const BRAND_GRADIENT = "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)";

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "Ocurrió un error.");
      return;
    }
    setInfo(result.data.message);
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
        <h2 className="m-0 mb-1 text-xl font-bold text-slate-900">Restablecer contraseña</h2>
        <p className="mb-6 mt-0 text-[13px] text-slate-500">
          Te enviaremos un enlace al correo asociado a tu cuenta. El enlace expira en 30 minutos.
        </p>

        {info ? (
          <div className="mb-4 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[13px] leading-relaxed text-emerald-800">
            ✉️ {info}
          </div>
        ) : (
          <div className="mb-3.5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-base">✉️</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="usuario@gruposoul.com"
                className="w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 pl-[42px] text-sm text-slate-900 outline-none"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {!info && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed"
            style={{
              background: loading ? "#94a3b8" : BRAND_GRADIENT,
              boxShadow: loading ? "none" : "0 4px 16px rgba(0,194,168,0.4)",
            }}
          >
            {loading ? "Enviando..." : "Enviar enlace →"}
          </button>
        )}

        <button
          onClick={onBackToLogin}
          className="mt-3 w-full p-2.5 text-[13px] font-semibold text-cyan-700"
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </AuthLayout>
  );
}
