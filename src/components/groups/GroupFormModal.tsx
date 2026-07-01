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

const GROUP_ICONS = ["👥", "🏥", "💼", "🔬", "💊", "📊", "⚙️", "🎯", "🏢", "📋", "🧑‍💻", "🩺"];

const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm text-gray-900 outline-none";

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
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <h2 className="m-0 mb-5 text-lg font-bold text-gray-900">
          {mode === "edit" ? "Editar Grupo" : "Nuevo Grupo"}
        </h2>

        <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
          Nombre *
        </label>
        <input
          className={INPUT_CLASS}
          placeholder="Ej: Talento Humano"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          autoFocus
        />

        <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
          Descripción
        </label>
        <input
          className={INPUT_CLASS}
          placeholder="Descripción opcional..."
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
        />

        <label className="mb-2 block text-xs font-semibold uppercase text-gray-500">Color</label>
        <div className="mb-4 flex gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...values, color: c })}
              className="h-[30px] w-[30px] cursor-pointer rounded-full"
              style={{
                background: c,
                border: values.color === c ? "3px solid #111827" : "3px solid transparent",
              }}
            />
          ))}
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase text-gray-500">Ícono</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {GROUP_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => onChange({ ...values, icon: ic })}
              className="h-[38px] w-[38px] cursor-pointer rounded-lg text-xl"
              style={{
                border:
                  values.icon === ic ? `2px solid ${values.color}` : "2px solid #e2e8f0",
                background: values.icon === ic ? values.color + "18" : "#fff",
              }}
            >
              {ic}
            </button>
          ))}
        </div>

        {error && <p className="m-0 mb-3 text-[13px] text-red-600">⚠️ {error}</p>}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2.5 text-[13px] font-semibold text-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="cursor-pointer rounded-lg border-none px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
            style={{ background: values.color }}
          >
            {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { GroupFormValues };
