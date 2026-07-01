import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, ROLE_AVATARS, type UserRole } from "../../types/auth.types";

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
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-5">
      <div className="flex max-h-[85vh] w-full max-w-[500px] flex-col rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="mb-4">
          <h2 className="m-0 mb-1 text-lg font-bold text-gray-900">{title}</h2>
          <p className="m-0 text-[13px] text-gray-500">{subtitle}</p>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-gray-400">Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-gray-400">No hay usuarios registrados</p>
          ) : (
            users.map((user) => {
              const checked = userIds.has(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => onToggle(user.id)}
                  className="mb-1.5 flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-3 transition-all"
                  style={{
                    borderColor: checked ? "#bbf7d0" : "#e2e8f0",
                    background: checked ? "#f0fdf4" : "#fff",
                  }}
                >
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px]"
                    style={{
                      border: `2px solid ${checked ? ACCENT : "#d1d5db"}`,
                      background: checked ? ACCENT : "#fff",
                    }}
                  >
                    {checked && <span className="text-[13px] text-white">✓</span>}
                  </div>
                  <span className="text-xl">{ROLE_AVATARS[user.role as UserRole]}</span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: checked ? "#065f46" : "#111827" }}
                    >
                      {user.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {user.email} · {ROLE_LABELS[user.role as UserRole]}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2.5 border-t border-slate-200 pt-4">
          <span className="text-xs text-gray-400">
            {userIds.size} usuario{userIds.size !== 1 ? "s" : ""} asignado
            {userIds.size !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-2 text-[13px] font-semibold text-gray-500"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="cursor-pointer rounded-lg border-none px-3.5 py-2 text-[13px] font-semibold text-white"
              style={{ background: ACCENT, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Guardando..." : "💾 Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
