import { useState } from "react";
import type { AuthUser } from "../../types/auth.types";
import { ROLE_AVATARS, sanitizePermissions } from "../../types/auth.types";
import {
  login,
  saveSession,
  type LoginFinalResponse,
} from "../../services/api";
import TwoFactorSetupPanel from "./TwoFactorSetupPanel";
import TwoFactorCodePanel from "./TwoFactorCodePanel";

export type AppOption = {
  id: "soulforms" | "consientify";
  name: string;
  description: string;
  icon: string;
  gradient: string;
  shadow: string;
  accent: string;
};

type LoginModalProps = {
  app: AppOption;
  onClose: () => void;
  onLogin: (user: AuthUser, app: AppOption["id"], token: string) => void;
  onGoForgot: () => void;
  onGoRegister: () => void;
};

type Step =
  | { kind: "credentials" }
  | { kind: "2fa_setup"; setupToken: string }
  | { kind: "2fa_verify"; pendingToken: string };

export default function LoginModal({
  app,
  onClose,
  onLogin,
  onGoForgot,
  onGoRegister,
}: LoginModalProps) {
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cuando un panel 2FA completa con éxito, recibimos el response final
  // (access_token + user) y disparamos el callback de login.
  const handle2FASuccess = (result: LoginFinalResponse) => {
    const { access_token, user } = result;
    saveSession(access_token, user);
    const authUser: AuthUser = {
      ...user,
      avatar: ROLE_AVATARS[user.role] ?? "👤",
      permissions: sanitizePermissions(user.permissions),
    };
    onLogin(authUser, app.id, access_token);
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
      // Tres ramas según la respuesta del backend.
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in w-full max-w-[420px] rounded-[20px] bg-white px-9 pb-8 pt-9 shadow-[0_24px_60px_rgba(0,40,80,0.3)]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px]"
              style={{
                background: app.gradient,
                boxShadow: `0 4px 12px ${app.shadow}`,
              }}
            >
              {app.icon}
            </div>
            <div>
              <div className="text-lg font-extrabold text-slate-900">
                {app.name}
              </div>
              <div className="text-xs text-slate-500">
                {step.kind === "credentials"
                  ? "Ingresa tus credenciales"
                  : step.kind === "2fa_setup"
                    ? "Activa el doble factor"
                    : "Verificación en 2 pasos"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-base text-slate-500 transition hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {step.kind === "credentials" && (
          <>
            <div className="mb-[14px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] text-gray-700">
                Correo electrónico
              </label>
              <div className="relative" style={{ color: app.accent }}>
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
              <div className="relative" style={{ color: app.accent }}>
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
                background: loading ? "#94a3b8" : app.gradient,
                boxShadow: loading ? "none" : `0 4px 16px ${app.shadow}`,
              }}
            >
              {loading ? (
                <>
                  <span className="animate-spin-slow inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                  Ingresando...
                </>
              ) : (
                `Ingresar a ${app.name} →`
              )}
            </button>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoForgot();
                }}
                className="p-1 text-xs font-semibold"
                style={{ color: app.accent }}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoRegister();
                }}
                className="p-1 text-xs font-semibold"
                style={{ color: app.accent }}
              >
                Crear cuenta →
              </button>
            </div>
          </>
        )}

        {step.kind === "2fa_setup" && (
          <TwoFactorSetupPanel
            setupToken={step.setupToken}
            accent={app.accent}
            gradient={app.gradient}
            shadow={app.shadow}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}

        {step.kind === "2fa_verify" && (
          <TwoFactorCodePanel
            pendingToken={step.pendingToken}
            accent={app.accent}
            gradient={app.gradient}
            shadow={app.shadow}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}
      </div>
    </div>
  );
}
