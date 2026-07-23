import { useState } from "react";
import AuthLayout from "../components/auth/AuthLayout";
import {
  login,
  saveSession,
  type LoginFinalResponse,
} from "../services/api";
import { ROLE_AVATARS, sanitizePermissions, type AuthUser } from "../types/auth.types";
import TwoFactorSetupPanel from "../components/auth/TwoFactorSetupPanel";
import TwoFactorCodePanel from "../components/auth/TwoFactorCodePanel";

type ConsientifyLoginProps = {
  onLoginSuccess: (user: AuthUser, token: string) => void;
  onGoForgot: () => void;
};

const SKY_GRADIENT = "linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%)";
const SKY_SHADOW = "rgba(2,132,199,0.35)";
const SKY_ACCENT = "#0284c7";

type Step =
  | { kind: "credentials" }
  | { kind: "2fa_setup"; setupToken: string }
  | { kind: "2fa_verify"; pendingToken: string };

export default function ConsientifyLogin({
  onLoginSuccess,
  onGoForgot,
}: ConsientifyLoginProps) {
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle2FASuccess = (result: LoginFinalResponse) => {
    const { access_token, user } = result;
    saveSession(access_token, user);
    const authUser: AuthUser = {
      ...user,
      avatar: ROLE_AVATARS[user.role] ?? "👤",
      permissions: sanitizePermissions(user.permissions),
    };
    onLoginSuccess(authUser, access_token);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.error || !result.data) {
        setError(result.error ?? "Correo o contraseña incorrectos.");
        return;
      }
      const data = result.data;
      if (data.requires2FA && data.requiresSetup) {
        setStep({ kind: "2fa_setup", setupToken: data.setupToken });
        return;
      }
      if (data.requires2FA && !data.requiresSetup) {
        setStep({ kind: "2fa_verify", pendingToken: data.pendingToken });
        return;
      }
      handle2FASuccess(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error de conexión. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-[14px] py-3 pl-[42px] text-sm text-slate-900 outline-none transition focus:border-current focus:bg-white";

  return (
    <AuthLayout maxWidth="sm">
      <div className="w-full rounded-[20px] bg-white px-9 pb-8 pt-9 shadow-[0_24px_60px_rgba(2,40,80,0.3)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-[30px]"
            style={{ background: SKY_GRADIENT, boxShadow: `0 6px 20px ${SKY_SHADOW}` }}
          >
            📋
          </div>
          <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-slate-900">
            Consientify
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step.kind === "credentials"
              ? "Gestión de consentimientos informados"
              : step.kind === "2fa_setup"
                ? "Activa el doble factor para continuar"
                : "Verifica tu identidad"}
          </p>
        </div>

        {step.kind === "credentials" && (
          <>
            <div className="mb-[14px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Correo electrónico
              </label>
              <div className="relative" style={{ color: SKY_ACCENT }}>
                <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-base">
                  ✉️
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="usuario@gruposoul.com"
                  autoFocus
                  className={inputBase}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Contraseña
              </label>
              <div className="relative" style={{ color: SKY_ACCENT }}>
                <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-base">
                  🔒
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className={`${inputBase} pr-11`}
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

            {error && (
              <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-[14px] py-2.5 text-sm text-red-600">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-bold text-white transition disabled:cursor-not-allowed"
              style={{
                background: loading ? "#94a3b8" : SKY_GRADIENT,
                boxShadow: loading ? "none" : `0 4px 16px ${SKY_SHADOW}`,
              }}
            >
              {loading ? (
                <>
                  <span className="animate-spin-slow inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                  Ingresando...
                </>
              ) : (
                "Ingresar a Consientify →"
              )}
            </button>

            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={onGoForgot}
                className="p-1 text-xs font-semibold"
                style={{ color: SKY_ACCENT }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </>
        )}

        {step.kind === "2fa_setup" && (
          <TwoFactorSetupPanel
            setupToken={step.setupToken}
            accent={SKY_ACCENT}
            gradient={SKY_GRADIENT}
            shadow={SKY_SHADOW}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}

        {step.kind === "2fa_verify" && (
          <TwoFactorCodePanel
            pendingToken={step.pendingToken}
            accent={SKY_ACCENT}
            gradient={SKY_GRADIENT}
            shadow={SKY_SHADOW}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}
      </div>
    </AuthLayout>
  );
}
