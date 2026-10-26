import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, type UserRole } from "../../types/auth.types";
import Icon from "../common/Icon";
import Avatar from "../common/Avatar";

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
  index?: number;
};

export default function UserListItem({
  user,
  onEdit,
  onToggleActive,
  onDelete,
  index = 0,
}: UserListItemProps) {
  const role = user.role as UserRole;
  const color = ROLE_COLORS[role];

  return (
    <div
      className="animate-fade-up flex flex-wrap items-center gap-3 rounded-[20px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_1px_3px_rgba(15,45,90,0.06)] ring-1 ring-slate-900/[0.03] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.005] hover:shadow-[0_16px_34px_-14px_rgba(15,45,90,0.28)] sm:gap-4 sm:px-5"
      style={{ opacity: user.isActive ? 1 : 0.62, animationDelay: `${index * 40}ms` }}
    >
      <Avatar name={user.name} size={48} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
            {user.name}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: `${color}18`, color }}
          >
            {ROLE_LABELS[role]}
          </span>
          {!user.isActive && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-400">
              Inactivo
            </span>
          )}
          {user.totpEnabled ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600"
              title="El usuario tiene 2FA configurado"
            >
              <Icon name="lock" size={11} /> 2FA
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-400"
              title="El usuario aún no ha configurado 2FA — lo hará en su próximo login"
            >
              <Icon name="lock" size={11} /> Sin 2FA
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">{user.email}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          Registrado: {new Date(user.createdAt).toLocaleDateString("es-CO")}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-1.5">
        <button
          onClick={() => onEdit(user)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-slate-900"
        >
          <Icon name="edit" size={13} /> Editar
        </button>
        <button
          onClick={() => onToggleActive(user)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px"
          style={
            user.isActive
              ? { background: "#fffbeb", color: "#d97706", borderColor: "#fde68a" }
              : { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
          }
        >
          <Icon name="power" size={13} /> {user.isActive ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={() => onDelete(user)}
          title="Eliminar usuario"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-600 transition-all duration-150 hover:-translate-y-px hover:bg-red-100"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}
