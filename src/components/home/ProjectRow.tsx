import type { ThemeTokens, DensityTokens } from "../../context/ThemeContext";
import Icon from "../common/Icon";
import PopoverMenu from "../common/PopoverMenu";

type FolderLite = { id: string; name: string; icon: string; color: string; forms: unknown[] };
type ProjectLite = { id: string; name: string; icon: string; color: string };

export type ProjectRowProps = {
  project: ProjectLite;
  isActive: boolean;
  isExpanded: boolean;
  isAnclado: boolean;
  totalForms: number;
  projectFolders: FolderLite[];
  selectedFolderId: string | null;
  T: ThemeTokens;
  D: DensityTokens;
  onSelect: () => void;
  onToggleExpand: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onDelete: () => void;
  onSelectFolder: (id: string) => void;
  onNewFolder: () => void;
  onEditFolder: (id: string) => void;
  onDupFolder: (id: string, name: string) => void;
  onDelFolder: (id: string, name: string) => void;
};

export default function ProjectRow({
  project,
  isActive,
  isExpanded,
  isAnclado,
  totalForms,
  projectFolders,
  selectedFolderId,
  T,
  D,
  onSelect,
  onToggleExpand,
  onTogglePin,
  onEdit,
  onAssign,
  onDelete,
  onSelectFolder,
  onNewFolder,
  onEditFolder,
  onDupFolder,
  onDelFolder,
}: ProjectRowProps) {
  return (
    <div className="mb-0.5">
      <div
        onClick={() => {
          onSelect();
          onToggleExpand();
        }}
        className="flex cursor-pointer items-center rounded-[7px] transition-colors duration-100"
        style={{
          gap: D.gap,
          padding: D.rowPad,
          background: isActive ? T.bgHover : "transparent",
          borderLeft: `3px solid ${isActive ? project.color : "transparent"}`,
        }}
        onMouseOver={(e) => {
          if (!isActive) e.currentTarget.style.background = T.bgElev;
        }}
        onMouseOut={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <div
          className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md text-xs"
          style={{ background: project.color + "28", color: project.color }}
        >
          {project.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              fontSize: D.fsProj,
              fontWeight: isActive ? 700 : 600,
              color: isActive ? T.textStrong : T.text,
            }}
          >
            {project.name}
          </div>
        </div>
        <span
          className="rounded font-mono text-[10px] font-semibold"
          style={{
            color: T.badgeText,
            background: T.badgeBg,
            padding: "1px 5px",
          }}
        >
          {totalForms}
        </span>
        <PopoverMenu
          T={T}
          items={[
            { label: isAnclado ? "Desanclar" : "Anclar", icon: "pin", onClick: onTogglePin },
            { label: "Editar", icon: "edit", onClick: onEdit },
            { label: "Asignar usuarios", icon: "users", onClick: onAssign },
            { label: "Eliminar", icon: "trash", onClick: onDelete, destructive: true },
          ]}
        />
        <span
          className="flex transition-transform duration-200"
          style={{
            color: T.textMuted,
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <Icon name="caretDown" size={14} />
        </span>
      </div>
      {isExpanded && (
        <div
          className="mb-1 ml-4 mt-0.5 border-l pl-3"
          style={{ borderColor: T.nestBorder }}
        >
          {projectFolders.length === 0 ? (
            <div
              className="px-2.5 py-1.5 text-[11px] italic"
              style={{ color: T.textMuted }}
            >
              Sin carpetas
            </div>
          ) : (
            projectFolders.map((folder) => {
              const isFolderActive = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => onSelectFolder(folder.id)}
                  className="flex cursor-pointer items-center rounded-[5px] transition-colors"
                  style={{
                    gap: D.gap,
                    padding: D.nestPad,
                    background: isFolderActive ? folder.color + "15" : "transparent",
                    borderLeft: `2px solid ${isFolderActive ? folder.color : "transparent"}`,
                  }}
                  onMouseOver={(e) => {
                    if (!isFolderActive) e.currentTarget.style.background = T.bgElev;
                  }}
                  onMouseOut={(e) => {
                    if (!isFolderActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="text-[11px]">{folder.icon}</span>
                  <span
                    className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      fontSize: D.fs,
                      fontWeight: isFolderActive ? 700 : 500,
                      color: isFolderActive ? folder.color : T.text,
                    }}
                  >
                    {folder.name}
                  </span>
                  <span
                    className="rounded font-mono text-[10px] font-semibold"
                    style={{
                      color: isFolderActive ? folder.color : T.badgeText,
                      background: isFolderActive ? folder.color + "15" : T.badgeBg,
                      padding: "1px 5px",
                    }}
                  >
                    {folder.forms.length}
                  </span>
                  <PopoverMenu
                    T={T}
                    items={[
                      { label: "Editar", icon: "edit", onClick: () => onEditFolder(folder.id) },
                      { label: "Duplicar", icon: "copy", onClick: () => onDupFolder(folder.id, folder.name) },
                      { label: "Eliminar", icon: "trash", onClick: () => onDelFolder(folder.id, folder.name), destructive: true },
                    ]}
                  />
                </div>
              );
            })
          )}
          {isActive && (
            <div
              onClick={onNewFolder}
              className="flex cursor-pointer items-center gap-1.5 rounded-[5px] text-[11.5px]"
              style={{ padding: D.nestPad, color: T.textMuted }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = T.bgElev;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon name="plus" size={12} /> Nueva carpeta
            </div>
          )}
        </div>
      )}
    </div>
  );
}
