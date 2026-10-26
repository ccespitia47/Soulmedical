import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AuthUser } from "../../types/auth.types";
import { ROLE_AVATARS, sanitizePermissions } from "../../types/auth.types";
import {
  login,
  saveSession,
  type LoginFinalResponse,
} from "../../services/api";
import TwoFactorSetupPanel from "./TwoFactorSetupPanel";
import TwoFactorCodePanel from "./TwoFactorCodePanel";

/* Iconos de línea para los campos del formulario (mismo estilo que AppIcon). */
const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const MailIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);
const LockIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconProps}>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconProps}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconProps}>
    <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.7M6.3 6.4A15.9 15.9 0 0 0 2.5 12s3.5 6 9.5 6a9.4 9.4 0 0 0 4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);
const AlertIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...iconProps}>
    <path d="M12 4 3 19h18L12 4Z" />
    <line x1="12" y1="10.5" x2="12" y2="14" />
    <path d="M12 16.7v.01" />
  </svg>
);

export type AppOption = {
  id: "soulforms" | "consientify";
  name: string;
  description: string;
  icon: string;
  gradient: string;
  shadow: string;
  accent: string;
};

// Logos oscuros (wordmark) y accent claro por app, para la tarjeta oscura.
const LOGOS: Record<AppOption["id"], string> = {
  soulforms: "/soulforms-logo-dark.png",
  consientify: "/consientify-logo-dark.png",
};
const FIELD_ACCENTS: Record<AppOption["id"], string> = {
  soulforms: "#2dd4bf",
  consientify: "#e879c7",
};

type LoginModalProps = {
  app: AppOption;
  onClose: () => void;
  onLogin: (user: AuthUser, app: AppOption["id"], token: string) => void;
  onGoForgot: () => void;
  onGoRegister: () => void;
  /**
   * Lado desde el que entra el modal en 3D, según la tarjeta que lo abrió.
   * "left"  → viene desde la izquierda (tarjeta izquierda, ej. SoulForms).
   * "right" → viene desde la derecha (tarjeta derecha, ej. Consientify).
   */
  direction?: "left" | "right";
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
  direction = "right",
}: LoginModalProps) {
  const reduce = useReducedMotion();
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

  // Ambas apps usan tarjeta oscura con el color de su logo (#0F1623).
  const dark = true;
  // Accent más claro para íconos/foco/enlaces sobre el fondo oscuro (los accent
  // de marca son muy oscuros ahí). El botón conserva su degradado.
  const fieldAccent = FIELD_ACCENTS[app.id];
  const logoSrc = LOGOS[app.id];

  const inputBase =
    "w-full rounded-[10px] border-[1.5px] border-white/15 bg-white/[0.05] px-[14px] py-3 pl-[42px] text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-current focus:bg-white/[0.09]";

  // Entrada 3D direccional: la tarjeta izquierda (SoulForms) llega desde la
  // izquierda avanzando hacia el centro; la derecha (Consientify), al revés.
  const fromLeft = direction === "left";
  const cardInitial = reduce
    ? { opacity: 0 }
    : {
        opacity: 0,
        x: fromLeft ? "-42%" : "42%",
        rotateY: fromLeft ? 26 : -26,
        scale: 0.9,
      };
  const cardAnimate = reduce
    ? { opacity: 1 }
    : { opacity: 1, x: "0%", rotateY: 0, scale: 1 };
  const cardTransition = reduce
    ? { duration: 0.2, ease: "easeOut" as const }
    : { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={cardInitial}
        animate={cardAnimate}
        transition={cardTransition}
        className="w-full max-w-[420px] overflow-hidden rounded-[20px] px-6 pb-7 pt-8 shadow-[0_24px_60px_rgba(0,40,80,0.3)] sm:px-9 sm:pb-8 sm:pt-9"
        style={{ background: dark ? "#0F1623" : "#ffffff", transformStyle: "preserve-3d" }}
      >
        {/* Logo grande sobre el fondo oscuro (mismo color del logo) */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <img
            src={logoSrc}
            alt={app.name}
            className="h-14 w-auto max-w-[250px] object-contain"
          />
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-none bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-[13px] font-medium text-slate-400">
          {step.kind === "credentials"
            ? "Ingresa tus credenciales"
            : step.kind === "2fa_setup"
              ? "Activa el doble factor"
              : "Verificación en 2 pasos"}
        </p>

        {step.kind === "credentials" && (
          <>
            <div className="mb-[14px]">
              <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] ${dark ? "text-slate-200" : "text-gray-700"}`}>
                Correo electrónico
              </label>
              <div className="relative" style={{ color: fieldAccent }}>
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2">
                  <MailIcon className="h-[18px] w-[18px]" />
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
              <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px] ${dark ? "text-slate-200" : "text-gray-700"}`}>
                Contraseña
              </label>
              <div className="relative" style={{ color: fieldAccent }}>
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2">
                  <LockIcon className="h-[18px] w-[18px]" />
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
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition ${dark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <EyeIcon className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className={`mb-4 flex items-center gap-2 rounded-lg border px-[14px] py-2.5 text-sm ${dark ? "border-red-400/30 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-600"}`}>
                <AlertIcon className="h-[18px] w-[18px] shrink-0" />
                <span>{error}</span>
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoForgot();
                }}
                className="p-1 text-xs font-semibold"
                style={{ color: fieldAccent }}
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
                style={{ color: fieldAccent }}
              >
                Crear cuenta →
              </button>
            </div>
          </>
        )}

        {step.kind === "2fa_setup" && (
          <TwoFactorSetupPanel
            setupToken={step.setupToken}
            accent={fieldAccent}
            gradient={app.gradient}
            shadow={app.shadow}
            dark={dark}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}

        {step.kind === "2fa_verify" && (
          <TwoFactorCodePanel
            pendingToken={step.pendingToken}
            accent={fieldAccent}
            gradient={app.gradient}
            shadow={app.shadow}
            dark={dark}
            onSuccess={handle2FASuccess}
            onCancel={() => setStep({ kind: "credentials" })}
          />
        )}
      </motion.div>
    </div>
  );
}
