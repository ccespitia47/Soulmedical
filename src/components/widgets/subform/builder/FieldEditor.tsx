import type { SubformField, SubformFieldType } from "../subform.types";
import {
  FIELDS_WITH_OPTIONS,
  FIELD_TYPES,
  SUBFORM_INPUT_CLASS,
  SUBFORM_LABEL_CLASS,
} from "./constants";

type FieldEditorProps = {
  field: SubformField | null;
  onUpdate: (id: string, changes: Partial<SubformField>) => void;
};

function FieldPreview({ field }: { field: SubformField }) {
  const requiredMark = field.required && (
    <span className="ml-0.5 text-red-500">*</span>
  );

  return (
    <div className="rounded-[10px] border-[1.5px] border-slate-200 bg-white px-4 py-3.5">
      <div className="mb-2 text-[11px] font-bold uppercase text-gray-400">
        Vista previa
      </div>
      <div className="mb-1.5 text-[13px] font-semibold text-gray-700">
        {field.label}
        {requiredMark}
      </div>
      {field.type === "textarea" && (
        <textarea
          disabled
          rows={2}
          placeholder={field.placeholder || ""}
          className={`${SUBFORM_INPUT_CLASS} resize-none opacity-60`}
        />
      )}
      {field.type === "select" && (
        <select disabled className={`${SUBFORM_INPUT_CLASS} opacity-60`}>
          <option>-- Selecciona --</option>
          {(field.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      {(field.type === "radio" || field.type === "checkbox") && (
        <div className="flex flex-col gap-1.5">
          {(field.options || []).map((o) => (
            <label
              key={o}
              className="flex items-center gap-1.5 text-[13px] text-gray-500"
            >
              <input
                type={field.type === "radio" ? "radio" : "checkbox"}
                disabled
              />{" "}
              {o}
            </label>
          ))}
        </div>
      )}
      {!["textarea", "select", "radio", "checkbox"].includes(field.type) && (
        <input
          disabled
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
              ? "number"
              : "text"
          }
          placeholder={field.placeholder || ""}
          className={`${SUBFORM_INPUT_CLASS} opacity-60`}
        />
      )}
    </div>
  );
}

export default function FieldEditor({ field, onUpdate }: FieldEditorProps) {
  if (!field) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
        <div className="mb-4 text-[60px]">👈</div>
        <p className="m-0 text-[15px] font-semibold text-gray-700">
          Selecciona un campo para editarlo
        </p>
        <p className="mt-1.5 text-[13px]">
          O haz clic en "+ Agregar" para crear uno nuevo
        </p>
      </div>
    );
  }

  const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
  const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);
  const hasPlaceholder = !["checkbox", "select", "radio"].includes(field.type);

  return (
    <div className="max-w-[520px]">
      <div className="mb-6 flex items-center gap-2.5 border-b-2 border-slate-200 pb-4">
        <span className="text-[28px]">{typeInfo?.icon}</span>
        <div>
          <div className="text-base font-extrabold text-gray-900">
            {field.label}
          </div>
          <div className="text-xs text-gray-500">{typeInfo?.label}</div>
        </div>
      </div>

      <div className="mb-[18px]">
        <label className={SUBFORM_LABEL_CLASS}>Etiqueta</label>
        <input
          className={SUBFORM_INPUT_CLASS}
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
        />
      </div>

      <div className="mb-[18px]">
        <label className={SUBFORM_LABEL_CLASS}>Tipo</label>
        <select
          className={`${SUBFORM_INPUT_CLASS} cursor-pointer`}
          value={field.type}
          onChange={(e) =>
            onUpdate(field.id, { type: e.target.value as SubformFieldType })
          }
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </div>

      {hasPlaceholder && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>Placeholder</label>
          <input
            className={SUBFORM_INPUT_CLASS}
            value={field.placeholder || ""}
            placeholder="Ej: Escribe aquí..."
            onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
          />
        </div>
      )}

      {hasOptions && (
        <div className="mb-[18px]">
          <label className={SUBFORM_LABEL_CLASS}>
            Opciones{" "}
            <span className="font-normal normal-case text-gray-400">
              (una por línea)
            </span>
          </label>
          <textarea
            className={`${SUBFORM_INPUT_CLASS} min-h-[100px] resize-y font-sans leading-relaxed`}
            value={(field.options || []).join("\n")}
            placeholder={"Opción 1\nOpción 2"}
            onChange={(e) =>
              onUpdate(field.id, {
                options: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </div>
      )}

      <label
        className="mb-[18px] flex cursor-pointer items-center gap-2.5 rounded-[10px] border-[1.5px] px-3.5 py-3"
        style={{
          background: field.required ? "#e6faf7" : "#f8fafc",
          borderColor: field.required ? "#00c2a8" : "#e2e8f0",
        }}
      >
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
          className="h-4 w-4"
        />
        <div>
          <div className="text-[13px] font-semibold text-gray-900">
            Campo obligatorio
          </div>
          <div className="text-[11px] text-gray-500">
            El usuario debe completar este campo
          </div>
        </div>
      </label>

      <FieldPreview field={field} />
    </div>
  );
}
