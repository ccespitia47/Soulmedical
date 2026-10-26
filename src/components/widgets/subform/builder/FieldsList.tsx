import { useState } from "react";
import type { SubformField, SubformFieldType } from "../subform.types";
import Icon from "../../../common/Icon";
import SubformFieldTypeSelect from "./SubformFieldTypeSelect";
import {
  FIELDS_WITH_OPTIONS,
  FIELD_TYPES,
  SUBFORM_FIELD_ICONS,
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
    <div className="mt-2 rounded-[10px] border-[1.5px] border-amber-400 bg-amber-50 p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-amber-700">
        <Icon name="plus" size={12} /> Nuevo campo
      </div>
      <div className="mb-2">
        <label className={`${SUBFORM_LABEL_CLASS} text-amber-800`}>Tipo</label>
        <SubformFieldTypeSelect value={type} onChange={setType} />
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
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-amber-500 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_-4px_rgba(245,158,11,0.55)] transition-transform hover:-translate-y-px"
        >
          <Icon name="check" size={13} /> Agregar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
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
        <span className="text-[13px] font-bold text-slate-700">
          Campos ({fields.length})
        </span>
        <button
          onClick={() => {
            setShowNew(true);
            onSelect(null);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.55)] transition-transform hover:-translate-y-px"
        >
          <Icon name="plus" size={13} /> Agregar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {fields.length === 0 && !showNew && (
          <div className="px-4 py-10 text-center text-slate-400">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Icon name="table" size={22} />
            </span>
            <p className="m-0 text-[13px] font-semibold text-slate-500">
              Sin campos
            </p>
            <p className="mt-1 text-xs">Haz clic en "+ Agregar"</p>
          </div>
        )}
        {fields.map((field, idx) => {
          const isActive = editingId === field.id;
          const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
          const iconName = SUBFORM_FIELD_ICONS[field.type] ?? "grid";
          return (
            <div
              key={field.id}
              onClick={() => {
                onSelect(field.id);
                setShowNew(false);
              }}
              className="group mb-1 flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] px-2.5 py-2 transition-colors"
              style={{
                background: isActive ? "#e6faf7" : "#f8fafc",
                borderColor: isActive ? "#00c2a8" : "#e2e8f0",
              }}
            >
              <div
                className="flex flex-col gap-0.5 text-slate-400"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onMove(field.id, -1)}
                  disabled={idx === 0}
                  aria-label="Subir"
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border-none bg-transparent p-0 text-slate-400 hover:text-slate-700 disabled:cursor-default disabled:opacity-30"
                  style={{ cursor: idx === 0 ? "default" : "pointer" }}
                >
                  <Icon name="caretDown" size={10} className="rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(field.id, 1)}
                  disabled={idx === fields.length - 1}
                  aria-label="Bajar"
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border-none bg-transparent p-0 text-slate-400 hover:text-slate-700 disabled:cursor-default disabled:opacity-30"
                  style={{ cursor: idx === fields.length - 1 ? "default" : "pointer" }}
                >
                  <Icon name="caretDown" size={10} />
                </button>
              </div>
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: isActive ? "rgba(0,194,168,0.15)" : "#fff",
                  color: isActive ? "#0891b2" : "#64748b",
                  border: `1px solid ${isActive ? "rgba(0,194,168,0.35)" : "#e2e8f0"}`,
                }}
              >
                <Icon name={iconName} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
                  style={{ color: isActive ? "#0891b2" : "#111827" }}
                >
                  {field.label}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: isActive ? "#0e9b94" : "#94a3b8" }}
                >
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
                aria-label="Eliminar campo"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Icon name="trash" size={14} />
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
