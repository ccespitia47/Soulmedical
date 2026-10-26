import type { TemplateItem, FolderItem } from "../../types/folder.types";
import EntityIcon from "../common/EntityIcon";
import Icon from "../common/Icon";

type TemplateFolder = Pick<FolderItem, "id" | "name" | "icon" | "color">;

type TemplateFoldersListProps = {
  folders: TemplateFolder[];
  templates: TemplateItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleteFolder: (folder: TemplateFolder) => void;
};

export default function TemplateFoldersList({
  folders,
  templates,
  selectedId,
  onSelect,
  onDeleteFolder,
}: TemplateFoldersListProps) {
  return (
    <div className="w-full flex-shrink-0 lg:w-[240px]">
      <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)]">
        <div className="border-b border-slate-100 px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.5px] text-gray-400">
          Carpetas
        </div>

        <div className="p-1.5">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left transition-colors"
            style={{
              background: selectedId === null ? "rgba(0,194,168,0.1)" : "transparent",
            }}
          >
            <span style={{ color: selectedId === null ? "#0891b2" : "#94a3b8" }}>
              <Icon name="grid" size={16} />
            </span>
            <span
              className="flex-1 text-[13px]"
              style={{
                fontWeight: selectedId === null ? 700 : 500,
                color: selectedId === null ? "#0891b2" : "#374151",
              }}
            >
              Todas
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={{
                background: selectedId === null ? "rgba(0,194,168,0.15)" : "#f1f5f9",
                color: selectedId === null ? "#0891b2" : "#64748b",
              }}
            >
              {templates.length}
            </span>
          </button>

          {folders.map((folder) => {
            const count = templates.filter((t) => t.folderId === folder.id).length;
            const isActive = selectedId === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => onSelect(folder.id)}
                className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors"
                style={{ background: isActive ? `${folder.color}14` : "transparent" }}
                onMouseOver={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#f1f5f9";
                }}
                onMouseOut={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span className="flex flex-shrink-0" style={{ color: folder.color }}>
                  <EntityIcon icon={folder.icon} size={16} />
                </span>
                <span
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                  style={{
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? folder.color : "#374151",
                  }}
                >
                  {folder.name}
                </span>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    background: isActive ? `${folder.color}22` : "#f1f5f9",
                    color: isActive ? folder.color : "#64748b",
                  }}
                >
                  {count}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder);
                  }}
                  aria-label="Eliminar carpeta"
                  className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
