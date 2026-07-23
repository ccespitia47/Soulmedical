import { useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import type { SubformEntry, SubformField, SubformRule } from "./subform.types";
import EntriesList from "./runtime/EntriesList";
import EntryModal from "./runtime/EntryModal";

type ModalState = { mode: "add" | "edit"; index: number } | null;

export default function SubformRender({ widget }: WidgetRenderProps) {
  const fields = (widget.config.fields as SubformField[]) || [];
  const rules = (widget.config.rules as SubformRule[]) || [];
  const addLabel = (widget.config.addButtonLabel as string) || "Agregar";
  const maxEntries = (widget.config.maxEntries as number) || 0;
  const minEntries = (widget.config.minEntries as number) || 0;

  const [entries, setEntries] = useState<SubformEntry[]>([]);
  const [modalState, setModalState] = useState<ModalState>(null);

  const closeModal = () => setModalState(null);

  const handleSave = (entry: SubformEntry) => {
    if (!modalState) return;
    if (modalState.mode === "add") {
      setEntries((prev) => [...prev, entry]);
    } else {
      setEntries((prev) =>
        prev.map((e, i) => (i === modalState.index ? entry : e)),
      );
    }
    closeModal();
  };

  const removeEntry = (idx: number) =>
    setEntries((prev) => prev.filter((_, i) => i !== idx));

  const canAdd = maxEntries === 0 || entries.length < maxEntries;
  const serialized = JSON.stringify(entries);
  const atMax = maxEntries > 0 && entries.length >= maxEntries;
  const belowMin = minEntries > 0 && entries.length < minEntries;
  const showCounter = minEntries > 0 || maxEntries > 0;

  return (
    <div>
      <input type="hidden" name={widget.id} value={serialized} />

      <label className="mb-2 block text-[13px] font-semibold text-gray-900">
        {widget.label}
        {widget.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <EntriesList
        entries={entries}
        fields={fields}
        onEdit={(idx) => setModalState({ mode: "edit", index: idx })}
        onRemove={removeEntry}
      />

      {entries.length === 0 && (
        <div className="mb-2.5 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-[18px] py-3.5 text-center text-[13px] text-slate-400">
          Sin entradas — haz clic en "{addLabel}" para agregar
        </div>
      )}

      {showCounter && (
        <div className="mb-2 text-[11px] text-gray-400">
          {entries.length}
          {maxEntries > 0 ? `/${maxEntries}` : ""} entrada
          {entries.length !== 1 ? "s" : ""}
          {belowMin && (
            <span className="ml-1.5 text-amber-500">
              ⚠️ Mínimo {minEntries}
            </span>
          )}
        </div>
      )}

      {canAdd && (
        <button
          type="button"
          onClick={() => setModalState({ mode: "add", index: -1 })}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[#00c2a8] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,194,168,0.25)] transition-colors hover:bg-[#00a896]"
        >
          ＋ {addLabel}
        </button>
      )}

      {atMax && (
        <div className="mt-1.5 text-[11px] text-amber-500">
          ⚠️ Límite máximo alcanzado ({maxEntries} entradas)
        </div>
      )}

      {modalState && (
        <EntryModal
          fields={fields}
          rules={rules}
          initial={modalState.mode === "edit" ? entries[modalState.index] : {}}
          title={
            modalState.mode === "add"
              ? `➕ ${addLabel}`
              : `✏️ Editar entrada`
          }
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
