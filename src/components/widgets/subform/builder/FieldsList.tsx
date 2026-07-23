import { useState } from "react";
import type { SubformField, SubformFieldType } from "../subform.types";
import {
  FIELDS_WITH_OPTIONS,
  FIELD_TYPES,
  SUBFORM_INPUT_CLASS,
  SUBFORM_LABEL_CLASS,
  uid,
} from "./constants";

type FieldsListProps = {
  fields: SubformField[];
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (field: SubformField) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
};

function NewFieldForm({
  onAdd,
  onCancel,
}: {
  onAdd: (field: SubformField) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<SubformFieldType>("text");
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    if (!label.trim()) return;
    onAdd({
      id: uid(),
      type,
      label: label.trim(),
      required: false,
      options: FIELDS_WITH_OPTIONS.includes(type) ? ["Opción 1"] : undefined,
    });
  };

  return (
    <div className="mt-2 rounded-[10px] border-[1.5px] border-amber-500 bg-amber-50 p-3.5">
      <div className="mb-2.5 text-xs font-bold uppercase text-amber-700">
        ✨ Nuevo campo
      </div>
      <div className="mb-2">
        <label className={`${SUBFORM_LABEL_CLASS} text-amber-800`}>Tipo</label>
        <select
          className={SUBFORM_INPUT_CLASS}
          value={type}
          onChange={(e) => setType(e.target.value as SubformFieldType)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2.5">
        <label className={`${SUBFORM_LABEL_CLASS} text-amber-800`}>Etiqueta *</label>
        <input
          className={SUBFORM_INPUT_CLASS}
          value={label}
          placeholder="Ej: Nombre del medicamento"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="flex-1 cursor-pointer rounded-[7px] border-none bg-amber-500 py-2.5 text-xs font-bold text-white"
        >
          ✅ Agregar
        </button>
        <button
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-[7px] border-none bg-gray-100 py-2.5 text-xs font-semibold text-gray-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function FieldsList({
  fields,
  editingId,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: FieldsListProps) {
  const [showNew, setShowNew] = useState(false);

  const handleAdd = (field: SubformField) => {
    onAdd(field);
    setShowNew(false);
  };

  return (
    <div className="flex w-[300px] flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <span className="text-[13px] font-bold text-gray-700">
          Campos ({fields.length})
        </span>
        <button
          onClick={() => {
            setShowNew(true);
            onSelect(null);
          }}
          className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-3 py-1 text-xs font-bold text-white"
        >
          + Agregar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {fields.length === 0 && !showNew && (
          <div className="px-4 py-10 text-center text-slate-400">
            <div className="mb-2.5 text-[40px]">🗂️</div>
            <p className="m-0 text-[13px] font-semibold">Sin campos</p>
            <p className="mt-1 text-xs">Haz clic en "+ Agregar"</p>
          </div>
        )}
        {fields.map((field, idx) => {
          const isActive = editingId === field.id;
          const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
          return (
            <div
              key={field.id}
              onClick={() => {
                onSelect(field.id);
                setShowNew(false);
              }}
              className="mb-1 flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2.5"
              style={{
                background: isActive ? "#e6faf7" : "#f8fafc",
                borderColor: isActive ? "#00c2a8" : "#e2e8f0",
              }}
            >
              <div
                className="flex flex-col gap-px"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onMove(field.id, -1)}
                  disabled={idx === 0}
                  className="border-none bg-transparent p-0 text-[9px] text-gray-500 disabled:opacity-30"
                  style={{ cursor: idx === 0 ? "default" : "pointer" }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onMove(field.id, 1)}
                  disabled={idx === fields.length - 1}
                  className="border-none bg-transparent p-0 text-[9px] text-gray-500 disabled:opacity-30"
                  style={{ cursor: idx === fields.length - 1 ? "default" : "pointer" }}
                >
                  ▼
                </button>
              </div>
              <span className="flex-shrink-0 text-lg">{typeInfo?.icon}</span>
              <div className="min-w-0 flex-1">
                <div
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
                  style={{ color: isActive ? "#059669" : "#111827" }}
                >
                  {field.label}
                </div>
                <div className="text-[11px] text-gray-400">
                  {typeInfo?.label}
                  {field.required ? " · obligatorio" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(field.id);
                }}
                className="cursor-pointer border-none bg-transparent p-0.5 text-sm text-red-300"
              >
                🗑️
              </button>
            </div>
          );
        })}
        {showNew && (
          <NewFieldForm
            onAdd={handleAdd}
            onCancel={() => setShowNew(false)}
          />
        )}
      </div>
    </div>
  );
}
