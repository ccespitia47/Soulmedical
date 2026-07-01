import type { TemplateItem, FolderItem } from "../../types/folder.types";

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
    <div className="w-[220px] flex-shrink-0">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-gray-400">
          Carpetas
        </div>

        <div
          onClick={() => onSelect(null)}
          className="flex cursor-pointer items-center gap-2 px-4 py-2.5"
          style={{
            background: selectedId === null ? "#e6faf7" : "transparent",
            borderLeft: `3px solid ${selectedId === null ? "#00c2a8" : "transparent"}`,
          }}
        >
          <span>📋</span>
          <span
            className="text-[13px]"
            style={{
              fontWeight: selectedId === null ? 700 : 500,
              color: selectedId === null ? "#00c2a8" : "#374151",
            }}
          >
            Todas ({templates.length})
          </span>
        </div>

        {folders.map((folder) => {
          const count = templates.filter((t) => t.folderId === folder.id).length;
          const isActive = selectedId === folder.id;
          return (
            <div
              key={folder.id}
              onClick={() => onSelect(folder.id)}
              className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5"
              style={{
                background: isActive ? "#e6faf7" : "transparent",
                borderLeft: `3px solid ${isActive ? folder.color : "transparent"}`,
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-base">{folder.icon}</span>
                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                  style={{
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? folder.color : "#374151",
                  }}
                >
                  {folder.name}
                </span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span className="text-[11px] text-gray-400">{count}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder);
                  }}
                  className="cursor-pointer rounded border-none bg-transparent px-1 py-px text-[13px] text-gray-400 hover:text-red-500"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
