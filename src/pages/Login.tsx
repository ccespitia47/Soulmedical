import { useState } from "react";
import type { AuthUser } from "../types/auth.types";
import logo from "../assets/Logo_GrupoSoul.png";
import AuthLayout from "../components/auth/AuthLayout";
import LoginModal, { type AppOption } from "../components/auth/LoginModal";

type LoginProps = {
  onLogin: (user: AuthUser, app: AppOption["id"]) => void;
  onGoRegister: () => void;
  onGoForgot: () => void;
};

const APPS: AppOption[] = [
  {
    id: "soulforms",
    name: "SoulForms",
    description: "Gestión clínica de formularios",
    icon: "🏥",
    gradient: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
    shadow: "rgba(0,194,168,0.35)",
    accent: "#00c2a8",
  },
  {
    id: "consientify",
    name: "Consientify",
    description: "Gestión de consentimientos",
    icon: "📋",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    shadow: "rgba(99,102,241,0.35)",
    accent: "#6366f1",
  },
];

export default function Login({ onLogin, onGoRegister, onGoForgot }: LoginProps) {
  const [selectedApp, setSelectedApp] = useState<AppOption["id"] | null>(null);
  const activeApp = APPS.find((a) => a.id === selectedApp);

  return (
    <AuthLayout maxWidth="lg">
      <div className="mb-8 text-center">
        <img
          src={logo}
          alt="Grupo Soul"
          className="mx-auto mb-3 h-12 object-contain opacity-95 brightness-0 invert"
        />
        <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">
          Grupo Soul
        </h1>
        <p className="mt-1 text-[13px] text-white/75">
          Selecciona la aplicación a la que deseas ingresar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {APPS.map((app) => (
          <button
            key={app.id}
            onClick={() => setSelectedApp(app.id)}
            className="group flex flex-col items-center gap-3.5 rounded-[20px] border border-white/70 bg-white/[0.88] p-6 text-center shadow-[0_24px_60px_rgba(0,40,80,0.22)] backdrop-blur-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_32px_80px_rgba(0,40,80,0.28)]"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-[18px] text-3xl"
              style={{ background: app.gradient, boxShadow: `0 8px 24px ${app.shadow}` }}
            >
              {app.icon}
            </div>
            <div>
              <div className="mb-1 text-lg font-extrabold text-slate-900">{app.name}</div>
              <div className="text-xs leading-snug text-slate-500">{app.description}</div>
            </div>
            <div
              className="w-full rounded-[10px] py-2.5 text-[13px] font-bold text-white"
              style={{ background: app.gradient, boxShadow: `0 4px 12px ${app.shadow}` }}
            >
              Ingresar →
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-white/55">
        © {new Date().getFullYear()} Grupo Soul · Todos los derechos reservados
      </p>

      {activeApp && (
        <LoginModal
          app={activeApp}
          onClose={() => setSelectedApp(null)}
          onLogin={onLogin}
          onGoForgot={onGoForgot}
          onGoRegister={onGoRegister}
        />
      )}
    </AuthLayout>
  );
}
