import { useState } from "react";
import { useFolderStore } from "../../store/useFolderStore";
import type { TemplateItem } from "../../types/folder.types";

type UseTemplateModalProps = {
  template: TemplateItem;
  onUse: (folderId: string, formId: string) => void;
  onClose: () => void;
};

const INPUT_CLASS =
  "mb-4 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 text-[13px] outline-none";

export default function UseTemplateModal({
  template,
  onUse,
  onClose,
}: UseTemplateModalProps) {
  const { folders, addFormFromTemplate } = useFolderStore();
  const [selectedFolderId, setSelectedFolderId] = useState(folders[0]?.id ?? "");
  const [formName, setFormName] = useState(template.name);
  const [creating, setCreating] = useState(false);

  const handleUse = async () => {
    if (!selectedFolderId || !formName.trim() || creating) return;
    setCreating(true);
    // Una sola llamada al backend con widgets + rules + emailTemplate.
    // Esto reemplaza el patrón anterior addForm + setTimeout que era frágil
    // ante cualquier latencia del backend.
    const newFormId = await addFormFromTemplate(
      selectedFolderId,
      formName.trim(),
      template.widgets,
      template.rules,
      template.emailTemplate,
    );
    setCreating(false);
    if (newFormId) onUse(selectedFolderId, newFormId);
  };

  const hasRules = (template.rules?.length ?? 0) > 0;
  const hasEmail = !!template.emailTemplate?.enabled;

  const canSubmit = !!formName.trim() && !!selectedFolderId;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-5">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <h2 className="m-0 mb-1.5 text-lg font-bold text-gray-900">
          {template.icon} Usar plantilla
        </h2>
        <p className="m-0 mb-5 text-[13px] text-gray-500">
          Se creará un nuevo formulario basado en <strong>{template.name}</strong>
        </p>

        <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
          Nombre del formulario *
        </label>
        <input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Nombre del formulario"
          autoFocus
          className={INPUT_CLASS}
        />

        <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
          Guardar en carpeta *
        </label>
        {folders.length === 0 ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
            ⚠️ No hay carpetas disponibles. Crea una carpeta primero en Formularios.
          </div>
        ) : (
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className={INPUT_CLASS}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        )}

        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
          ✅ Se copiarán{" "}
          <strong>
            {template.widgets.length} campo{template.widgets.length !== 1 ? "s" : ""}
          </strong>
          {hasRules && (
            <>
              ,{" "}
              <strong>
                {template.rules!.length} regla
                {template.rules!.length !== 1 ? "s" : ""}
              </strong>
            </>
          )}
          {hasEmail && (
            <>
              {" "}
              y la <strong>configuración de email</strong>
            </>
          )}{" "}
          de la plantilla
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2.5 text-sm font-semibold text-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleUse}
            disabled={!canSubmit || creating}
            className="cursor-pointer rounded-lg border-none px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
            style={{
              background: canSubmit && !creating ? "#00c2a8" : "#e2e8f0",
              color: canSubmit && !creating ? "#fff" : "#9ca3af",
            }}
          >
            {creating ? "Creando..." : "✅ Crear formulario"}
          </button>
        </div>
      </div>
    </div>
  );
}
