import type { GroupData } from "../../services/api";

type GroupsSidebarProps = {
  groups: GroupData[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (group: GroupData) => void;
  onCreate: () => void;
  onEdit: (group: GroupData) => void;
  onDelete: (group: GroupData) => void;
};

export default function GroupsSidebar({
  groups,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: GroupsSidebarProps) {
  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-3.5 pt-5">
        <div>
          <h2 className="m-0 text-base font-bold text-gray-900">🏷️ Grupos</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {groups.length} grupo{groups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onCreate}
          className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-3.5 py-1.5 text-xs font-semibold text-white"
        >
          + Nuevo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-gray-400">Cargando...</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-400">
            <span className="mb-2.5 block text-[40px]">🏷️</span>
            <p className="text-[13px] font-semibold">No hay grupos</p>
            <p className="text-xs">Crea el primero con el botón +</p>
          </div>
        ) : (
          groups.map((group) => {
            const isSelected = selectedId === group.id;
            return (
              <div
                key={group.id}
                onClick={() => onSelect(group)}
                className="mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all"
                style={{
                  background: isSelected ? group.color + "15" : "transparent",
                  borderLeft: `3px solid ${isSelected ? group.color : "transparent"}`,
                }}
                onMouseOver={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseOut={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg"
                  style={{ background: group.color + "20", color: group.color }}
                >
                  {group.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                    style={{
                      fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? group.color : "#111827",
                    }}
                  >
                    {group.name}
                  </div>
                  {group.description && (
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-gray-400">
                      {group.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(group)}
                    className="cursor-pointer rounded border-none bg-transparent px-1 py-0.5 text-[13px] text-gray-400"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(group)}
                    className="cursor-pointer rounded border-none bg-transparent px-1 py-0.5 text-[13px] text-gray-400"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
