import { useState } from "react";
import type { SubformField, SubformRule } from "../subform.types";
import FieldsList from "./FieldsList";
import FieldEditor from "./FieldEditor";
import SubformRulesPanel from "./SubformRulesPanel";

type SubformBuilderModalProps = {
  widgetLabel: string;
  fields: SubformField[];
  rules: SubformRule[];
  onSave: (fields: SubformField[], rules: SubformRule[]) => void;
  onClose: () => void;
};

type Tab = "fields" | "rules";

export default function SubformBuilderModal({
  widgetLabel,
  fields,
  rules,
  onSave,
  onClose,
}: SubformBuilderModalProps) {
  const [localFields, setLocalFields] = useState<SubformField[]>([...fields]);
  const [localRules, setLocalRules] = useState<SubformRule[]>([...rules]);
  const [activeTab, setActiveTab] = useState<Tab>("fields");
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateField = (id: string, changes: Partial<SubformField>) => {
    setLocalFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    );
  };

  const addField = (field: SubformField) => {
    setLocalFields((prev) => [...prev, field]);
    setEditingId(field.id);
  };

  const removeField = (id: string) => {
    setLocalFields((prev) => prev.filter((f) => f.id !== id));
    // Limpiar referencias en reglas
    setLocalRules((prev) =>
      prev.map((r) => ({
        ...r,
        conditions: r.conditions.filter((c) => c.fieldId !== id),
        targetFieldIds: r.targetFieldIds.filter((tid) => tid !== id),
      })),
    );
    if (editingId === id) setEditingId(null);
  };

  const moveField = (id: string, dir: -1 | 1) => {
    setLocalFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const editingField = localFields.find((f) => f.id === editingId) ?? null;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "fields", label: "Campos", count: localFields.length },
    { id: "rules", label: "Reglas", count: localRules.length },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-6">
      <div className="flex h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-xl">
              🗂️
            </div>
            <div>
              <div className="text-base font-extrabold text-gray-900">
                Configurar Subformulario
              </div>
              <div className="text-xs text-gray-500">
                {widgetLabel} · {localFields.length} campos · {localRules.length}{" "}
                reglas
              </div>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(localFields, localRules)}
              className="cursor-pointer rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-6 py-2 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(0,194,168,0.35)]"
            >
              💾 Guardar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 border-b border-slate-200 bg-white px-6">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 border-none bg-transparent px-5 py-2.5 font-sans text-[13px]"
                style={{
                  borderBottomColor: active ? "#00c2a8" : "transparent",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#00c2a8" : "#6b7280",
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="rounded-[10px] px-1.5 py-px text-[10px] font-bold"
                    style={{
                      background: active ? "#00c2a8" : "#e2e8f0",
                      color: active ? "#fff" : "#6b7280",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        {activeTab === "fields" ? (
          <div className="flex flex-1 overflow-hidden">
            <FieldsList
              fields={localFields}
              editingId={editingId}
              onSelect={setEditingId}
              onAdd={addField}
              onRemove={removeField}
              onMove={moveField}
            />
            <div className="flex-1 overflow-y-auto px-7 py-6">
              <FieldEditor field={editingField} onUpdate={updateField} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-7 py-6">
            <SubformRulesPanel
              rules={localRules}
              fields={localFields}
              onChange={setLocalRules}
            />
          </div>
        )}
      </div>
    </div>
  );
}
