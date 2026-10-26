import { useState } from "react";
import { useTemplatesStore } from "../store/useTemplatesStore";
import type { AuthUser } from "../types/auth.types";
import type { TemplateItem } from "../types/folder.types";
import { FOLDER_COLORS, FOLDER_ICONS } from "../types/folder.types";
import ConfirmModal from "../components/common/ConfirmModal";
import EntityFormModal from "../components/common/EntityFormModal";
import Icon from "../components/common/Icon";
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
    <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <div className="animate-fade-up mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.55)] sm:h-12 sm:w-12">
            <Icon name="templates" size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900 sm:text-[24px]">
              Plantillas
            </h1>
            <p className="mt-0.5 text-[12.5px] text-gray-500 sm:text-[13px]">
              Reutiliza formularios guardados como plantilla en cualquier proyecto.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)]"
        >
          <Icon name="plus" size={16} /> Nueva carpeta
        </button>
      </div>

      {templateFolders.length === 0 ? (
        <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-5 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00c2a8]/10 text-[#00c2a8]">
            <Icon name="templates" size={32} />
          </div>
          <h2 className="m-0 mb-2 text-xl font-extrabold tracking-tight text-slate-800">
            No hay carpetas de plantillas
          </h2>
          <p className="m-0 mb-6 text-sm leading-relaxed text-gray-400">
            Crea una carpeta para organizar tus plantillas.
            <br />
            Luego guarda formularios como plantillas desde el Builder.
          </p>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)]"
          >
            <Icon name="plus" size={16} /> Crear primera carpeta
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:gap-6">
          <TemplateFoldersList
            folders={templateFolders}
            templates={templates}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onDeleteFolder={(f) =>
              setConfirmDelete({ type: "folder", id: f.id, name: f.name })
            }
          />

          <div className="min-w-0 flex-1 self-stretch">
            {filteredTemplates.length === 0 ? (
              <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-5 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Icon name="templates" size={26} />
                </div>
                <p className="m-0 text-[15px] font-bold text-slate-700">
                  {selectedFolderId
                    ? "Esta carpeta no tiene plantillas aún"
                    : "No hay plantillas guardadas"}
                </p>
                <p className="m-0 mt-1.5 text-xs text-gray-400">
                  Ve al Builder y usa el botón "Plantilla" para guardar un formulario.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
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
          title="Nueva carpeta de plantillas"
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
