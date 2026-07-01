type ConsientifyProps = {
  onLogout: () => void;
};

const FEATURE_TILES = [
  { icon: "📝", label: "Consentimientos" },
  { icon: "✅", label: "Firmas digitales" },
  { icon: "📊", label: "Reportes" },
];

export default function Consientify({ onLogout }: ConsientifyProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 font-sans">
      <div className="text-center text-white">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
          📋
        </div>
        <h1 className="m-0 mb-2 text-4xl font-extrabold tracking-tight">Consientify</h1>
        <p className="m-0 mb-2 text-base opacity-80">Gestión de consentimientos informados</p>
        <p className="m-0 mb-10 text-[13px] opacity-60">
          Módulo en desarrollo · Disponible próximamente
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {FEATURE_TILES.map((t) => (
            <div
              key={t.label}
              className="min-w-[120px] rounded-xl bg-white/15 px-6 py-4 text-center backdrop-blur-md"
            >
              <div className="mb-1.5 text-2xl">{t.icon}</div>
              <div className="text-[13px] font-semibold">{t.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onLogout}
          className="mt-10 cursor-pointer rounded-xl border-2 border-white/40 bg-white/15 px-7 py-3 font-sans text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
}
