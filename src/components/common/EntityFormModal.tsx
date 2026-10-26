import { ModalShell, Field, ModalActions } from "./ModalShell";
import { ColorPicker, IconPicker } from "./Pickers";

const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15";

/** Oscurece un hex para el degradado del botón (identidad de la entidad). */
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

type ColorOption = { id: string; label: string; value: string };
type IconOption = { id: string; label: string };

type EntityFormModalProps = {
  title: string;
  submitLabel: string;
  placeholder?: string;
  name: string;
  color: string;
  icon: string;
  colors: ColorOption[];
  icons: IconOption[];
  onChangeName: (v: string) => void;
  onChangeColor: (v: string) => void;
  onChangeIcon: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function EntityFormModal({
  title,
  submitLabel,
  placeholder,
  name,
  color,
  icon,
  colors,
  icons,
  onChangeName,
  onChangeColor,
  onChangeIcon,
  onSubmit,
  onClose,
}: EntityFormModalProps) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      icon={icon}
      iconColor={color}
      subtitle="Personaliza el nombre, color e ícono."
    >
      <Field label="Nombre">
        <input
          className={INPUT_CLASS}
          placeholder={placeholder}
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </Field>
      <Field label="Color">
        <ColorPicker selected={color} onChange={onChangeColor} colors={colors} />
      </Field>
      <Field label="Icono">
        <IconPicker selected={icon} onChange={onChangeIcon} icons={icons} />
      </Field>
      <ModalActions>
        <button
          className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(15,40,80,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(15,40,80,0.5)]"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${shade(color, 0.28)} 100%)` }}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </ModalActions>
    </ModalShell>
  );
}
