import { useRef } from "react";

type Placeholder = {
  placeholder: string;
  description: string;
};

type SubjectFieldProps = {
  value: string;
  hasError: boolean;
  placeholders?: Placeholder[];
  onChange: (v: string) => void;
};

const INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px]";

export default function SubjectField({
  value,
  hasError,
  placeholders = [],
  onChange,
}: SubjectFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    const input = inputRef.current;
    if (!input) {
      // Fallback: agrega al final.
      onChange(value + placeholder);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = value.slice(0, start) + placeholder + value.slice(end);
    onChange(next);
    // Reposicionar el cursor justo después del placeholder insertado.
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + placeholder.length;
      input.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="mb-5">
      <label
        className="mb-1.5 block text-xs font-semibold uppercase"
        style={{ color: hasError ? "#dc2626" : "#6b7280" }}
      >
        Asunto *
        {hasError && (
          <span className="ml-1 font-normal text-red-600">
            — No puede estar vacío
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nuevo registro - Formulario"
        className={INPUT_CLASS}
        style={
          hasError
            ? { border: "1.5px solid #fca5a5", background: "#fef2f2" }
            : undefined
        }
      />
      {placeholders.length > 0 && (
        <div className="mt-2">
          <div className="mb-1.5 text-[10px] font-bold uppercase text-gray-400">
            Insertar campo del formulario donde está el cursor
          </div>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p, i) => (
              <button
                key={`${p.placeholder}-${i}`}
                type="button"
                // onMouseDown evita que el input pierda foco antes de insertar.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertPlaceholder(p.placeholder);
                }}
                title={p.description}
                className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-800 hover:bg-emerald-100"
              >
                {p.placeholder}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
