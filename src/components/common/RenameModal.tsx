import { ModalShell, Field, ModalActions } from "./ModalShell";

const ACCENT = "#00c2a8";
const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm outline-none";

type RenameModalProps = {
  title: string;
  submitLabel: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function RenameModal({
  title,
  submitLabel,
  placeholder,
  value,
  onChange,
  onSubmit,
  onClose,
}: RenameModalProps) {
  return (
    <ModalShell title={title} onClose={onClose} maxWidth={380}>
      <Field label="Nombre">
        <input
          className={INPUT_CLASS}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
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
