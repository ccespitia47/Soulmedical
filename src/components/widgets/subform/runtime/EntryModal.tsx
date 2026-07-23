import { useState } from "react";
import type {
  SubformEntry,
  SubformField,
  SubformRule,
} from "../subform.types";
import { evaluateSubformRules } from "../subform.types";
import FieldInput from "./FieldInput";

type EntryModalProps = {
  fields: SubformField[];
  rules: SubformRule[];
  initial: SubformEntry;
  title: string;
  onSave: (entry: SubformEntry) => void;
  onClose: () => void;
};

export default function EntryModal({
  fields,
  rules,
  initial,
  title,
  onSave,
  onClose,
}: EntryModalProps) {
  const [draft, setDraft] = useState<SubformEntry>({ ...initial });
  const [errors, setErrors] = useState<string[]>([]);

  const hiddenFieldIds = evaluateSubformRules(rules, draft);
  const visibleFields = fields.filter((f) => !hiddenFieldIds.has(f.id));

  const handleSave = () => {
    const missing = fields
      .filter(
        (f) =>
          f.required &&
          !hiddenFieldIds.has(f.id) &&
          !draft[f.id]?.toString().trim(),
      )
      .map((f) => f.label);
    if (missing.length > 0) {
      setErrors(missing);
      return;
    }
    onSave(draft);
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-[22px] py-[18px]">
          <h3 className="m-0 text-base font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-[15px] text-slate-500"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[22px] py-5">
          {fields.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400">
              Sin campos configurados.
            </p>
          ) : visibleFields.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400">
              Todos los campos están ocultos por reglas.
            </p>
          ) : (
            visibleFields.map((field) => (
              <div key={field.id} className="mb-4 transition-all">
                <label className="mb-1.5 block text-[13px] font-semibold text-gray-700">
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-red-500">*</span>
                  )}
                </label>
                <FieldInput
                  field={field}
                  value={draft[field.id] || ""}
                  onChange={(v) =>
                    setDraft((prev) => ({ ...prev, [field.id]: v }))
                  }
                />
              </div>
            ))
          )}

          {errors.length > 0 && (
            <div className="mt-2 rounded-lg border-[1.5px] border-red-200 bg-red-50 px-3.5 py-2.5">
              <div className="mb-1 text-xs font-bold text-red-600">
                ⚠️ Campos obligatorios:
              </div>
              <ul className="m-0 pl-[18px]">
                {errors.map((e) => (
                  <li key={e} className="text-xs text-red-700">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t border-slate-200 px-[22px] py-3.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,194,168,0.3)]"
          >
            💾 Guardar entrada
          </button>
        </div>
      </div>
    </div>
  );
}
