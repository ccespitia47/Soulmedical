import { useState } from "react";
import ConsentimientosPage from "./ConsentimientosPage";
import ConsentRecordsPage from "../components/consents/records/ConsentRecordsPage";
import MyTwoFactorButton from "../components/auth/MyTwoFactorButton";
import Icon from "../components/common/Icon";

type ConsientifyProps = {
  onLogout: () => void;
};

type View = "home" | "consentimientos" | "registros";

const FEATURE_TILES: {
  icon: string;
  label: string;
  view?: View;
  disabled?: boolean;
}[] = [
  { icon: "clipboard", label: "Consentimientos", view: "consentimientos" },
  { icon: "checkCircle", label: "Firmas digitales", disabled: true },
  { icon: "table", label: "Registros", view: "registros" },
];

export default function Consientify({ onLogout }: ConsientifyProps) {
  const [view, setView] = useState<View>("home");

  if (view === "consentimientos") {
    return <ConsentimientosPage onBack={() => setView("home")} />;
  }

  if (view === "registros") {
    return <ConsentRecordsPage onBack={() => setView("home")} />;
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 font-sans"
      style={{ background: "linear-gradient(160deg,#0F1623 0%,#131f34 100%)" }}
    >
      <div className="animate-fade-up text-center text-white">
        <img
          src="/consientify-logo-dark.png"
          alt="Consientify"
          className="mx-auto mb-4 h-16 w-auto max-w-[300px] object-contain"
        />
        <p className="m-0 mb-2 text-base text-slate-300">Gestión de consentimientos informados</p>
        <p className="m-0 mb-10 text-[13px] text-slate-500">
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
                className={`flex min-w-[128px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 text-center transition-all duration-200 ease-out ${
                  clickable
                    ? "cursor-pointer hover:-translate-y-0.5 hover:border-[#38bdf8]/40 hover:bg-white/[0.09] hover:shadow-[0_14px_30px_-14px_rgba(56,189,248,0.5)]"
                    : "cursor-not-allowed opacity-55"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#38bdf8]/15 text-[#7dd3fc]">
                  <Icon name={t.icon} size={22} />
                </span>
                <div className="text-[13px] font-semibold text-white">{t.label}</div>
                {t.disabled && (
                  <div className="text-[10px] text-slate-400">Próximamente</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <MyTwoFactorButton
            className="cursor-pointer rounded-xl border border-white/20 bg-white/[0.06] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-white/10"
          />
          <button
            onClick={onLogout}
            className="cursor-pointer rounded-xl border border-white/20 bg-white/[0.06] px-7 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
