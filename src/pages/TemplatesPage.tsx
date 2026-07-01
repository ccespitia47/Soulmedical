import { useState } from "react";
import { useTemplatesStore } from "../store/useTemplatesStore";
import type { AuthUser } from "../types/auth.types";
import type { TemplateItem } from "../types/folder.types";
import { FOLDER_COLORS, FOLDER_ICONS } from "../types/folder.types";
import ConfirmModal from "../components/common/ConfirmModal";
import EntityFormModal from "../components/common/EntityFormModal";
import TemplateFoldersList from "../components/templates/TemplateFoldersList";
import TemplateCard from "../components/templates/TemplateCard";
import UseTemplateModal from "../components/templates/UseTemplateModal";

type TemplatesPageProps = {
  onUseTemplate: (
    widgets: TemplateItem["widgets"],
    folderId: string,
    formId: string
  ) => void;
  currentUser: Pick<AuthUser, "name" | "role" | "avatar">;
};

type DeleteTarget = { type: "folder" | "template"; id: string; name: string };

export default function TemplatesPage({ onUseTemplate }: TemplatesPageProps) {
  const {
    templates,
    templateFolders,
    addTemplateFolder,
    deleteTemplateFolder,
    deleteTemplate,
  } = useTemplatesStore();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [useTemplate, setUseTemplate] = useState<TemplateItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);

  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0].value);
  const [folderIcon, setFolderIcon] = useState(FOLDER_ICONS[0].id);

  const filteredTemplates = selectedFolderId
    ? templates.filter((t) => t.folderId === selectedFolderId)
    : templates;

  const handleCreateFolder = () => {
    if (!folderName.trim()) return;
    addTemplateFolder(folderName.trim(), folderColor, folderIcon);
    setFolderName("");
    setFolderColor(FOLDER_COLORS[0].value);
    setFolderIcon(FOLDER_ICONS[0].id);
    setShowCreateFolder(false);
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "folder") deleteTemplateFolder(confirmDelete.id);
    else deleteTemplate(confirmDelete.id);
    setConfirmDelete(null);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-10 pt-8">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-gray-900">📑 Plantillas</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Reutiliza formularios guardados como plantilla en cualquier proyecto
          </p>
        </div>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="cursor-pointer rounded-[10px] border-none bg-[#00c2a8] px-[18px] py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(0,194,168,0.3)]"
        >
          + Nueva carpeta
        </button>
      </div>

      {templateFolders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-5 py-20 text-center">
          <span className="mb-4 block text-[64px]">📑</span>
          <h2 className="m-0 mb-2.5 text-xl font-bold text-gray-700">
            No hay carpetas de plantillas
          </h2>
          <p className="m-0 mb-6 text-sm leading-relaxed text-gray-400">
            Crea una carpeta para organizar tus plantillas.
            <br />
            Luego guarda formularios como plantillas desde el Builder.
          </p>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="cursor-pointer rounded-[10px] border-none bg-[#00c2a8] px-6 py-3 text-sm font-bold text-white"
          >
            + Crear primera carpeta
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-6">
          <TemplateFoldersList
            folders={templateFolders}
            templates={templates}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onDeleteFolder={(f) =>
              setConfirmDelete({ type: "folder", id: f.id, name: f.name })
            }
          />

          <div className="flex-1">
            {filteredTemplates.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-5 py-14 text-center">
                <span className="mb-3 block text-5xl">📑</span>
                <p className="m-0 text-sm text-gray-400">
                  {selectedFolderId
                    ? "Esta carpeta no tiene plantillas aún"
                    : "No hay plantillas guardadas"}
                </p>
                <p className="m-0 mt-2 text-xs text-slate-300">
                  Ve al Builder y usa el botón "📑 Plantilla" para guardar un formulario
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {filteredTemplates.map((template) => {
                  const folder = templateFolders.find((f) => f.id === template.folderId);
                  return (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      folder={folder}
                      onUse={() => setUseTemplate(template)}
                      onDelete={() =>
                        setConfirmDelete({
                          type: "template",
                          id: template.id,
                          name: template.name,
                        })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateFolder && (
        <EntityFormModal
          title="📁 Nueva carpeta de plantillas"
          submitLabel="Crear carpeta"
          placeholder="Ej: Formularios clínicos"
          name={folderName}
          color={folderColor}
          icon={folderIcon}
          colors={FOLDER_COLORS}
          icons={FOLDER_ICONS}
          onChangeName={setFolderName}
          onChangeColor={setFolderColor}
          onChangeIcon={setFolderIcon}
          onSubmit={handleCreateFolder}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {useTemplate && (
        <UseTemplateModal
          template={useTemplate}
          onUse={(folderId, formId) => {
            const widgets = useTemplate.widgets;
            setUseTemplate(null);
            onUseTemplate(widgets, folderId, formId);
          }}
          onClose={() => setUseTemplate(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={
            confirmDelete.type === "folder"
              ? "¿Eliminar carpeta?"
              : "¿Eliminar plantilla?"
          }
          message={`<strong>"${confirmDelete.name}"</strong> será eliminada permanentemente.${
            confirmDelete.type === "folder"
              ? " Las plantillas dentro quedarán sin carpeta."
              : ""
          }`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
