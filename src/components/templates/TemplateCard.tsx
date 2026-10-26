import type { TemplateItem, FolderItem } from "../../types/folder.types";
import EntityIcon from "../common/EntityIcon";
import Icon from "../common/Icon";

type TemplateFolder = Pick<FolderItem, "id" | "name" | "icon" | "color">;

type TemplateCardProps = {
  template: TemplateItem;
  folder?: TemplateFolder;
  onUse: () => void;
  onDelete: () => void;
};

export default function TemplateCard({
  template,
  folder,
  onUse,
  onDelete,
}: TemplateCardProps) {
  const accent = folder?.color ?? "#00c2a8";
  return (
    <div className="group flex flex-col rounded-[20px] border border-slate-200/80 bg-white px-4 pb-4 pt-4 shadow-[0_1px_4px_rgba(15,40,80,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_38px_-16px_rgba(15,40,80,0.28)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${accent}14`, color: accent }}
          >
            <EntityIcon icon={template.icon} size={20} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900">{template.name}</div>
            {folder && (
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                <EntityIcon icon={folder.icon} size={12} />
                <span className="truncate">{folder.name}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label="Eliminar plantilla"
          className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Icon name="trash" size={15} />
        </button>
      </div>

      {template.description && (
        <p className="m-0 mb-3 line-clamp-2 text-xs leading-relaxed text-gray-500">
          {template.description}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `${accent}14`, color: accent }}
        >
          <Icon name="fileText" size={11} />
          {template.widgets.length} campo{template.widgets.length !== 1 ? "s" : ""}
        </span>
        <span className="truncate text-[11px] text-gray-400">por {template.createdBy}</span>
      </div>

      <button
        onClick={onUse}
        className="mt-auto inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-2 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)]"
      >
        <Icon name="checkCircle" size={15} /> Usar plantilla
      </button>
    </div>
  );
}
