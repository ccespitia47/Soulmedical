import type { GroupData } from "../../services/api";
import Icon from "../common/Icon";
import EntityIcon from "../common/EntityIcon";

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
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 pb-3.5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_6px_16px_-6px_rgba(0,194,168,0.6)]">
            <Icon name="tag" size={17} />
          </div>
          <div>
            <h2 className="m-0 text-[15px] font-extrabold tracking-tight text-slate-900">Grupos</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {groups.length} grupo{groups.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-6px_rgba(0,194,168,0.6)]"
        >
          <Icon name="plus" size={14} /> Nuevo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-gray-400">
            <Icon name="refresh" size={15} className="animate-spin" /> Cargando…
          </div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Icon name="tag" size={24} />
            </div>
            <p className="text-[13px] font-bold text-slate-700">No hay grupos</p>
            <p className="mt-0.5 text-xs text-gray-400">Crea el primero con el botón +</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map((group, i) => {
              const isSelected = selectedId === group.id;
              return (
                <div
                  key={group.id}
                  onClick={() => onSelect(group)}
                  className="group animate-fade-up flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 transition-all duration-200 ease-out hover:-translate-y-0.5"
                  style={{
                    borderColor: isSelected ? group.color + "55" : "transparent",
                    background: isSelected ? group.color + "12" : "transparent",
                    boxShadow: isSelected ? `0 8px 20px -12px ${group.color}99` : "none",
                    animationDelay: `${i * 30}ms`,
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: group.color + "20", color: group.color }}
                  >
                    <EntityIcon icon={group.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                      style={{
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? group.color : "#0f172a",
                      }}
                    >
                      {group.name}
                    </div>
                    {group.description && (
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-gray-500">
                        {group.description}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex flex-shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onEdit(group)}
                      aria-label="Editar grupo"
                      className="flex cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(group)}
                      aria-label="Eliminar grupo"
                      className="flex cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
