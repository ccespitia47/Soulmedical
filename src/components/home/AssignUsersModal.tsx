import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, type UserRole } from "../../types/auth.types";
import Avatar from "../common/Avatar";
import Icon from "../common/Icon";
import { ROLE_COLORS } from "../users/UserListItem";

const ACCENT = "#00c2a8";

type AssignUsersModalProps = {
  title: string;
  subtitle: string;
  users: UserApiData[];
  userIds: Set<number>;
  loading: boolean;
  saving: boolean;
  onToggle: (id: number) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function AssignUsersModal({
  title,
  subtitle,
  users,
  userIds,
  loading,
  saving,
  onToggle,
  onSave,
  onClose,
}: AssignUsersModalProps) {
  // El título llega con un emoji al inicio desde el caller; lo quitamos para
  // mostrarlo limpio junto al ícono SVG (solo visual, no cambia la lógica).
  const cleanTitle = title.replace(/^[^\p{L}\p{N}]+/u, "").trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      <div className="animate-modal-in flex max-h-[85vh] w-full max-w-[500px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]">
        {/* Header */}
        <div className="flex items-start gap-3.5 px-6 pt-6 pb-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.6)]">
            <Icon name="users" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[19px] font-extrabold tracking-tight text-slate-900">
              {cleanTitle}
            </h2>
            <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-gray-400">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-gray-400">
              <Icon name="refresh" size={16} className="animate-spin" /> Cargando usuarios…
            </div>
          ) : users.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon name="users" size={24} />
              </div>
              <p className="text-[13px] font-medium text-gray-400">No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-1">
              {users.map((user, i) => {
                const checked = userIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => onToggle(user.id)}
                    className="animate-fade-up flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01]"
                    style={{
                      borderColor: checked ? "rgba(0,194,168,0.4)" : "#e2e8f0",
                      background: checked ? "rgba(0,194,168,0.06)" : "#fff",
                      boxShadow: checked
                        ? "0 8px 22px -12px rgba(0,194,168,0.5)"
                        : "0 1px 3px rgba(15,45,90,0.05)",
                      animationDelay: `${i * 35}ms`,
                    }}
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[6px] transition-colors"
                      style={{
                        border: `2px solid ${checked ? ACCENT : "#cbd5e1"}`,
                        background: checked ? ACCENT : "#fff",
                      }}
                    >
                      {checked && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </span>
                    <Avatar name={user.name} size={34} color={ROLE_COLORS[user.role as UserRole]} />
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13.5px] font-semibold"
                        style={{ color: checked ? "#0f766e" : "#0f172a" }}
                      >
                        {user.name}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">
                        {user.email} · {ROLE_LABELS[user.role as UserRole]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Icon name="checkCircle" size={13} className="text-[#00c2a8]" />
            {userIds.size} usuario{userIds.size !== 1 ? "s" : ""} asignado
            {userIds.size !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              <Icon name="checkCircle" size={15} />
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
