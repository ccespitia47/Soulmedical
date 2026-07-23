import { useState } from "react";
import ConsentimientosPage from "./ConsentimientosPage";
import MyTwoFactorButton from "../components/auth/MyTwoFactorButton";

type ConsientifyProps = {
  onLogout: () => void;
};

type View = "home" | "consentimientos";

const FEATURE_TILES: {
  icon: string;
  label: string;
  view?: View;
  disabled?: boolean;
}[] = [
  { icon: "📝", label: "Consentimientos", view: "consentimientos" },
  { icon: "✅", label: "Firmas digitales", disabled: true },
  { icon: "📊", label: "Reportes", disabled: true },
];

export default function Consientify({ onLogout }: ConsientifyProps) {
  const [view, setView] = useState<View>("home");

  if (view === "consentimientos") {
    return <ConsentimientosPage onBack={() => setView("home")} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 font-sans">
      <div className="text-center text-white">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
          📋
        </div>
        <h1 className="m-0 mb-2 text-4xl font-extrabold tracking-tight">Consientify</h1>
        <p className="m-0 mb-2 text-base opacity-80">Gestión de consentimientos informados</p>
        <p className="m-0 mb-10 text-[13px] opacity-60">
          Selecciona un módulo para comenzar
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {FEATURE_TILES.map((t) => {
            const clickable = !t.disabled && t.view;
            return (
              <button
                key={t.label}
                type="button"
                disabled={t.disabled}
                onClick={() => clickable && setView(t.view!)}
                className={`min-w-[120px] rounded-xl bg-white/15 px-6 py-4 text-center backdrop-blur-md transition-all ${
                  clickable
                    ? "cursor-pointer hover:-translate-y-0.5 hover:bg-white/25"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <div className="mb-1.5 text-2xl">{t.icon}</div>
                <div className="text-[13px] font-semibold">{t.label}</div>
                {t.disabled && (
                  <div className="mt-1 text-[10px] opacity-70">Próximamente</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <MyTwoFactorButton
            className="cursor-pointer rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3 font-sans text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
          />
          <button
            onClick={onLogout}
            className="cursor-pointer rounded-xl border-2 border-white/40 bg-white/15 px-7 py-3 font-sans text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
