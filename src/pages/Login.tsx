import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { AuthUser } from "../types/auth.types";
import logo from "../assets/Logo_GrupoSoul.png";
import AuthLayout from "../components/auth/AuthLayout";
import LoginModal, { type AppOption } from "../components/auth/LoginModal";
import { tiltMove, tiltReset } from "../lib/cardTilt";

// Logos oscuros (wordmark completo) por app — viven en /public.
const LOGOS: Record<AppOption["id"], string> = {
  soulforms: "/soulforms-logo-dark.png",
  consientify: "/consientify-logo-dark.png",
};

// Sombra de color del tilt en hover, a juego con el degradado de cada app.
const CARD_GLOW: Record<AppOption["id"], string> = {
  soulforms: "rgba(22,180,206,0.5)",
  consientify: "rgba(190,56,151,0.5)",
};

type LoginProps = {
  onLogin: (user: AuthUser, app: AppOption["id"], token: string) => void;
  onGoRegister: () => void;
  onGoForgot: () => void;
};

const APPS: AppOption[] = [
  {
    id: "soulforms",
    name: "SoulForms",
    description: "Gestión de Formularios",
    icon: "🏥",
    gradient: "linear-gradient(135deg, #1CB4CE 0%, #127E96 100%)",
    shadow: "rgba(22,166,192,0.35)",
    accent: "#0F7C90",
  },
  {
    id: "consientify",
    name: "Consientify",
    description: "Gestión de consentimientos",
    icon: "📋",
    gradient: "linear-gradient(135deg, #BE3897 0%, #8A2570 100%)",
    shadow: "rgba(166,46,138,0.32)",
    accent: "#A62E8A",
  },
];

export default function Login({ onLogin, onGoRegister, onGoForgot }: LoginProps) {
  const [selectedApp, setSelectedApp] = useState<AppOption["id"] | null>(null);
  const activeApp = APPS.find((a) => a.id === selectedApp);
  const reduce = useReducedMotion();

  // El modal entra desde el lado de la tarjeta que lo abrió: la columna
  // izquierda (índice 0) empuja desde la izquierda; la derecha, desde la derecha.
  const modalDirection: "left" | "right" =
    APPS.findIndex((a) => a.id === selectedApp) === 0 ? "left" : "right";

  return (
    <AuthLayout maxWidth="lg" variant="light" bgImage="/background.png">
      <div className="animate-fade-up mb-9 text-center">
        <img
          src={logo}
          alt="Grupo Soul"
          className="mx-auto mb-5 h-11 object-contain"
        />
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Grupo Soul
        </h1>
        <p className="mx-auto mt-2.5 max-w-[340px] text-[15px] leading-relaxed text-slate-500">
          Selecciona la aplicación a la que deseas ingresar
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {APPS.map((app, i) => (
          <button
            key={app.id}
            onClick={() => setSelectedApp(app.id)}
            onMouseMove={reduce ? undefined : (e) => tiltMove(e, CARD_GLOW[app.id])}
            onMouseLeave={reduce ? undefined : tiltReset}
            style={{
              animationDelay: `${120 + i * 90}ms`,
              background: "#0F1623",
              transformStyle: "preserve-3d",
            }}
            className="group animate-fade-up relative flex flex-col items-center gap-5 rounded-[20px] border border-white/10 p-7 text-center shadow-[0_22px_54px_-16px_rgba(15,25,50,0.55)] transition-all duration-300 ease-out"
          >
            {/* Brillo radial que sigue al cursor (posición via --mx/--my). */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.28), transparent 55%)",
              }}
            />
            <img
              src={LOGOS[app.id]}
              alt={app.name}
              className="relative z-10 w-full max-w-[240px] object-contain transition-transform duration-300 ease-out group-hover:scale-105"
            />
            <div className="relative z-10 text-[13px] font-semibold leading-relaxed text-slate-300">
              {app.description}
            </div>
            <div
              className="relative z-10 mt-1 w-full rounded-xl py-3 text-sm font-bold text-white shadow-[0_6px_16px_-6px_var(--tw-shadow-color)] transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_26px_-8px_var(--tw-shadow-color)]"
              style={{ background: app.gradient, ["--tw-shadow-color" as string]: app.shadow }}
            >
              Ingresar →
            </div>
          </button>
        ))}
      </div>

      <p className="animate-fade-up mt-7 text-center text-xs text-slate-400" style={{ animationDelay: "320ms" }}>
        © {new Date().getFullYear()} Grupo Soul · Todos los derechos reservados
      </p>

      {activeApp && (
        <LoginModal
          app={activeApp}
          direction={modalDirection}
          onClose={() => setSelectedApp(null)}
          onLogin={onLogin}
          onGoForgot={onGoForgot}
          onGoRegister={onGoRegister}
        />
      )}
    </AuthLayout>
  );
}