import type { TemplateItem, FolderItem } from "../../types/folder.types";

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
  return (
    <div
      className="flex flex-col rounded-xl border border-slate-200 bg-white px-4 pb-3.5 pt-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-shadow"
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-50 to-sky-50 text-[22px]">
            {template.icon}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{template.name}</div>
            {folder && (
              <div className="mt-0.5 text-[11px] text-gray-400">
                {folder.icon} {folder.name}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="cursor-pointer rounded border-none bg-transparent px-1 py-0.5 text-sm text-gray-400 hover:text-red-500"
        >
          🗑️
        </button>
      </div>

      {template.description && (
        <p className="m-0 mb-3 text-xs leading-relaxed text-gray-500">
          {template.description}
        </p>
      )}

      <div className="mb-3.5 flex gap-2.5">
        <span className="rounded-[20px] bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {template.widgets.length} campo{template.widgets.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-gray-400">por {template.createdBy}</span>
      </div>

      <button
        onClick={onUse}
        className="mt-auto w-full cursor-pointer rounded-lg border-none bg-[#00c2a8] px-2 py-2 text-[13px] font-bold text-white shadow-[0_2px_6px_rgba(0,194,168,0.25)]"
      >
        ✅ Usar plantilla
      </button>
    </div>
  );
}
