import type { SubformEntry, SubformField } from "../subform.types";

type EntriesListProps = {
  entries: SubformEntry[];
  fields: SubformField[];
  onEdit: (idx: number) => void;
  onRemove: (idx: number) => void;
};

function getEntryLabel(entry: SubformEntry, fields: SubformField[]): string {
  if (fields.length === 0) return "Entrada";
  const first = entry[fields[0]?.id];
  return first ? String(first).slice(0, 40) : "Entrada";
}

function getEntrySubtitle(
  entry: SubformEntry,
  fields: SubformField[],
): string {
  if (fields.length <= 1) return "";
  return fields
    .slice(1, 3)
    .map((f) =>
      entry[f.id] ? `${f.label}: ${String(entry[f.id]).slice(0, 20)}` : null,
    )
    .filter(Boolean)
    .join(" · ");
}

export default function EntriesList({
  entries,
  fields,
  onEdit,
  onRemove,
}: EntriesListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-2.5 flex flex-col gap-1.5">
      {entries.map((entry, idx) => {
        const subtitle = getEntrySubtitle(entry, fields);
        return (
          <div
            key={idx}
            className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-2"
          >
            <span className="text-base">🗂️</span>
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-gray-900">
                {getEntryLabel(entry, fields)}
              </div>
              {subtitle && (
                <div className="mt-px text-[11px] text-gray-400">
                  {subtitle}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(idx)}
              className="cursor-pointer rounded-md border-none bg-slate-100 px-2.5 py-1 text-xs font-semibold text-gray-700"
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="cursor-pointer rounded-md border-none bg-red-50 px-2 py-1 text-xs text-red-500"
            >
              🗑️
            </button>
          </div>
        );
      })}
    </div>
  );
}
