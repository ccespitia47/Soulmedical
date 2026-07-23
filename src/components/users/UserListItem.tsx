import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, ROLE_AVATARS, type UserRole } from "../../types/auth.types";

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7c3aed",
  coordinator: "#0891b2",
  user: "#d97706",
};

type UserListItemProps = {
  user: UserApiData;
  onEdit: (user: UserApiData) => void;
  onToggleActive: (user: UserApiData) => void;
  onDelete: (user: UserApiData) => void;
};

export default function UserListItem({
  user,
  onEdit,
  onToggleActive,
  onDelete,
}: UserListItemProps) {
  const role = user.role as UserRole;
  const color = ROLE_COLORS[role];

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-slate-200 bg-white px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
      style={{ opacity: user.isActive ? 1 : 0.6 }}
    >
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[22px]"
        style={{
          background: `${color}18`,
          border: `2px solid ${color}33`,
        }}
      >
        {ROLE_AVATARS[role]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{user.name}</span>
          <span
            className="rounded-[20px] px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: `${color}18`, color }}
          >
            {ROLE_LABELS[role]}
          </span>
          {!user.isActive && (
            <span className="rounded-[20px] bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-400">
              Inactivo
            </span>
          )}
          {user.totpEnabled ? (
            <span
              className="rounded-[20px] bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
              title="El usuario tiene 2FA configurado"
            >
              🔐 2FA
            </span>
          ) : (
            <span
              className="rounded-[20px] bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400"
              title="El usuario aún no ha configurado 2FA — lo hará en su próximo login"
            >
              🔓 Sin 2FA
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">{user.email}</div>
        <div className="mt-0.5 text-[11px] text-gray-400">
          Registrado: {new Date(user.createdAt).toLocaleDateString("es-CO")}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-1.5">
        <button
          onClick={() => onEdit(user)}
          className="cursor-pointer rounded-[7px] border border-slate-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
        >
          ✏️ Editar
        </button>
        <button
          onClick={() => onToggleActive(user)}
          className="cursor-pointer rounded-[7px] border px-3 py-1.5 text-xs font-semibold"
          style={
            user.isActive
              ? { background: "#fffbeb", color: "#d97706", borderColor: "#fde68a" }
              : { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
          }
        >
          {user.isActive ? "⏸ Desactivar" : "▶ Activar"}
        </button>
        <button
          onClick={() => onDelete(user)}
          className="cursor-pointer rounded-[7px] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
