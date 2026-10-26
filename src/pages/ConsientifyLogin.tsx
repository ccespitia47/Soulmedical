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
import Icon from "../components/common/Icon";

type ConsientifyLoginProps = {
  onLoginSuccess: (user: AuthUser, token: string) => void;
  onGoForgot: () => void;
};

const SKY_GRADIENT = "linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%)";
const SKY_SHADOW = "rgba(2,132,199,0.35)";

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

  // Tarjeta oscura con el color del logo de Consientify.
  const fieldAccent = "#38bdf8";
  const inputBase =
    "w-full rounded-[10px] border-[1.5px] border-white/15 bg-white/[0.05] px-[14px] py-3 pl-[42px] text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-current focus:bg-white/[0.09]";

  return (
    <AuthLayout maxWidth="sm" variant="light" bgImage="/background.png">
      <div
        className="animate-modal-in w-full overflow-hidden rounded-[20px] px-9 pb-8 pt-9 shadow-[0_28px_70px_-18px_rgba(15,25,50,0.55)]"
        style={{ background: "#0F1623" }}
      >
        <div className="mb-1 flex items-center justify-center">
          <img
            src="/consientify-logo-dark.png"
            alt="Consientify"
            className="h-14 w-auto max-w-[250px] object-contain"
          />
        </div>
        <p className="mb-6 text-center text-[13px] font-medium text-slate-400">
          {step.kind === "credentials"
            ? "Gestión de consentimientos informados"
            : step.kind === "2fa_setup"
              ? "Activa el doble factor para continuar"
              : "Verifica tu identidad"}
        </p>

        {step.kind === "credentials" && (
          <>
            <div className="mb-[14px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-200">
                Correo electrónico
              </label>
              <div className="relative" style={{ color: fieldAccent }}>
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2">
                  <Icon name="mail" size={18} />
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-200">
                Contraseña
              </label>
              <div className="relative" style={{ color: fieldAccent }}>
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2">
                  <Icon name="lock" size={18} />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 transition hover:text-slate-200"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-[14px] py-2.5 text-sm text-red-300">
                <Icon name="alert" size={16} className="shrink-0" /> {error}
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
                style={{ color: fieldAccent }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </>
        )}

        {step.kind === "2fa_setup" && (
          <TwoFactorSetupPanel
            setupToken={step.setupToken}
            accent={fieldAccent}
            gradient={SKY_GRADIENT}
            shadow={SKY_SHADOW}
            dark
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}

        {step.kind === "2fa_verify" && (
          <TwoFactorCodePanel
            pendingToken={step.pendingToken}
            accent={fieldAccent}
            gradient={SKY_GRADIENT}
            shadow={SKY_SHADOW}
            dark
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}
      </div>
    </AuthLayout>
  );
}
