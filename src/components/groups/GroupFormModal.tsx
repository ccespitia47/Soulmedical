import Icon from "../common/Icon";
import { resolveIconName } from "../common/EntityIcon";
import { ColombiaIconsSection } from "../common/Pickers";

const GROUP_COLORS = [
  "#6366f1",
  "#00c2a8",
  "#0891b2",
  "#f97316",
  "#e11d48",
  "#16a34a",
  "#d97706",
  "#475569",
];

// Íconos SVG modernos (reemplazan a los emojis). Los grupos ya creados con
// emoji siguen mostrándose bien vía EntityIcon (mapa de compatibilidad).
const GROUP_ICONS = [
  "users",
  "health",
  "building",
  "clipboard",
  "chart",
  "wallet",
  "target",
  "package",
  "settings",
  "fileText",
  "tag",
  "smartphone",
];

const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15";

/** Oscurece un color hex para armar el degradado del botón/tile del grupo. */
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

type GroupFormValues = {
  name: string;
  description: string;
  color: string;
  icon: string;
};

type GroupFormModalProps = {
  mode: "create" | "edit";
  values: GroupFormValues;
  saving: boolean;
  error: string;
  onChange: (v: GroupFormValues) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function GroupFormModal({
  mode,
  values,
  saving,
  error,
  onChange,
  onSubmit,
  onClose,
}: GroupFormModalProps) {
  const accent = values.color;
  const accentGradient = `linear-gradient(135deg, ${accent} 0%, ${shade(accent, 0.28)} 100%)`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      <div className="animate-modal-in w-full max-w-[440px] overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]">
        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-start gap-3.5">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_-6px_rgba(15,40,80,0.4)] transition-all"
              style={{ background: accentGradient }}
            >
              <Icon name="users" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900">
                {mode === "edit" ? "Editar grupo" : "Nuevo grupo"}
              </h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-gray-400">
                Define el nombre, color e ícono del grupo.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="x" size={17} />
            </button>
          </div>

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
            Nombre *
          </label>
          <input
            className={INPUT_CLASS}
            placeholder="Ej: Talento Humano"
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            autoFocus
          />

          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
            Descripción
          </label>
          <input
            className={INPUT_CLASS}
            placeholder="Descripción opcional..."
            value={values.description}
            onChange={(e) => onChange({ ...values, description: e.target.value })}
          />

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
            Color
          </label>
          <div className="mb-4 flex flex-wrap gap-2.5">
            {GROUP_COLORS.map((c) => {
              const active = values.color === c;
              return (
                <button
                  key={c}
                  onClick={() => onChange({ ...values, color: c })}
                  aria-label={`Color ${c}`}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: active
                      ? `0 0 0 3px #fff, 0 0 0 5px ${c}, 0 6px 14px -4px ${c}99`
                      : `0 2px 6px -2px ${c}66`,
                  }}
                >
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
            Ícono
          </label>
          <div className="mb-3 flex flex-wrap gap-2">
            {GROUP_ICONS.map((ic) => {
              const active = resolveIconName(values.icon) === ic;
              return (
                <button
                  key={ic}
                  onClick={() => onChange({ ...values, icon: ic })}
                  className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-105"
                  style={{
                    border: active ? `2px solid ${accent}` : "2px solid #e2e8f0",
                    background: active ? accent + "18" : "#fff",
                    color: active ? accent : "#64748b",
                    boxShadow: active ? `0 6px 16px -6px ${accent}80` : "0 1px 3px rgba(15,45,90,0.05)",
                  }}
                >
                  <Icon name={ic} size={20} />
                </button>
              );
            })}
          </div>

          <div className="mb-5">
            <ColombiaIconsSection
              selected={values.icon}
              onChange={(v) => onChange({ ...values, icon: v })}
            />
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border-[1.5px] border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
              <Icon name="alert" size={15} className="flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(15,40,80,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(15,40,80,0.5)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
              style={{ background: accentGradient }}
            >
              <Icon name="checkCircle" size={15} />
              {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear grupo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { GroupFormValues };
