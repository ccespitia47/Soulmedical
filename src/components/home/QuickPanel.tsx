import type { ThemeTokens } from "../../context/ThemeContext";
import type { FolderItem } from "../../types/folder.types";
import type { RecentEntry } from "../../hooks/useHomePersistence";
import Icon from "../common/Icon";

type QuickPanelProps = {
  mode: "recents" | "favorites";
  T: ThemeTokens;
  recents: RecentEntry[];
  favorites: string[];
  folders: FolderItem[];
  onNavigate: (folderId: string, formId: string) => void;
  onClose: () => void;
};

export default function QuickPanel({
  mode,
  T,
  recents,
  favorites,
  folders,
  onNavigate,
  onClose,
}: QuickPanelProps) {
  const items =
    mode === "recents"
      ? recents.slice(0, 10)
      : (favorites
          .map((fid) => {
            for (const f of folders) {
              const form = f.forms.find((fm) => fm.id === fid);
              if (form)
                return {
                  formId: fid,
                  folderId: f.id,
                  formName: form.name,
                  folderName: f.name,
                  ts: 0,
                };
            }
            return null;
          })
          .filter(Boolean) as RecentEntry[]);

  return (
    <div
      className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-[10px] border shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
      style={{ background: T.bgElev, borderColor: T.border }}
    >
      <div className="flex items-center justify-between px-3.5 pb-2 pt-2.5">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.07em]"
          style={{ color: T.label }}
        >
          {mode === "recents" ? "Recientes" : "Favoritos"}
        </span>
        <button
          onClick={onClose}
          className="flex cursor-pointer border-none bg-transparent"
          style={{ color: T.textMuted }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      {items.length === 0 ? (
        <div
          className="px-3.5 py-5 text-center text-xs"
          style={{ color: T.textMuted }}
        >
          {mode === "recents"
            ? "Aún no has abierto formularios"
            : "No tienes formularios favoritos"}
        </div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto px-1.5 pb-2">
          {items.map(
            (item) =>
              item && (
                <div
                  key={`${item.folderId}-${item.formId}`}
                  onClick={() => {
                    onNavigate(item.folderId, item.formId);
                    onClose();
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 py-2"
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = T.bgHover;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="flex-shrink-0 text-base">📋</span>
                  <div className="min-w-0">
                    <div
                      className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
                      style={{ color: T.textStrong }}
                    >
                      {item.formName}
                    </div>
                    <div className="text-[10.5px]" style={{ color: T.textMuted }}>
                      {item.folderName}
                    </div>
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
