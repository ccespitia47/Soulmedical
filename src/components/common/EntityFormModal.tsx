import { ModalShell, Field, ModalActions } from "./ModalShell";
import { ColorPicker, IconPicker } from "./Pickers";

const ACCENT = "#00c2a8";
const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm outline-none";

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
    <ModalShell title={title} onClose={onClose}>
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
          className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-2 text-[13px] font-semibold text-gray-500"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="cursor-pointer rounded-lg border-none px-3.5 py-2 text-[13px] font-semibold text-white"
          style={{ background: ACCENT }}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </ModalActions>
    </ModalShell>
  );
}
