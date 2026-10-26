import { useState } from "react";
import type { AuthUser } from "../../types/auth.types";
import { userHasPermission } from "../../types/auth.types";
import { useTheme } from "../../context/ThemeContext";
import MyTwoFactorButton from "../auth/MyTwoFactorButton";
import EditMyProfileModal from "../auth/EditMyProfileModal";
import Avatar from "../common/Avatar";
import Icon from "../common/Icon";

export type AdminSection =
  | "formularios"
  | "plantillas"
  | "usuarios"
  | "auditoria"
  | "reportes"
  | "api_keys";

type AdminSidebarProps = {
  section: AdminSection;
  // Incluye `permissions` para filtrar items de menú según permisos EXTRA
  // (no solo el rol base).
  currentUser: Pick<AuthUser, "name" | "role" | "avatar" | "permissions">;
  onSelectSection: (s: AdminSection) => void;
  onSwitchToUserApp: () => void;
  onLogout: () => void;
  /** Estado del drawer en móvil. En escritorio el sidebar es siempre visible. */
  open?: boolean;
  onClose?: () => void;
};

// `permission` opcional: si está presente el item solo se muestra a usuarios
// que tengan ese permiso (rol base o extra). `adminOnly` fuerza que solo el
// rol admin lo vea, independientemente de sus permisos extra — se usa para
// gestión de usuarios: el coordinador nunca debe editar/eliminar/crear
// cuentas ni ver el panel de administración de usuarios.
type NavItem = {
  id: AdminSection;
  icon: string;
  label: string;
  permission?: "audit_view" | "reports_view";
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: "formularios", icon: "clipboard", label: "Formularios" },
  { id: "plantillas", icon: "templates", label: "Plantillas" },
  { id: "usuarios", icon: "users", label: "Usuarios", adminOnly: true },
  { id: "auditoria", icon: "eye", label: "Reporte de acciones", permission: "audit_view" },
  { id: "reportes", icon: "chart", label: "Reporte", permission: "reports_view" },
  // API Keys: solo visibles para admin (gating duplicado backend+frontend por
  // defensa en profundidad; el backend también exige rol admin en el controller).
  { id: "api_keys", icon: "key", label: "API Keys", adminOnly: true },
];

const ACCENT = "#00c2a8";

export default function AdminSidebar({
  section,
  currentUser,
  onSelectSection,
  onSwitchToUserApp,
  onLogout,
  open = false,
  onClose,
}: AdminSidebarProps) {
  const { T } = useTheme();
  // Modal de auto-edición de perfil. Se abre al clickear el chip del avatar.
  // Cualquier usuario (admin/coordinator/user) puede editar SU información,
  // pero no rol ni 2FA — el backend (PATCH /auth/profile) lo garantiza.
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      {/* Backdrop móvil/tablet */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] min-h-screen flex-shrink-0 flex-col border-r transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: T.bgElev, borderColor: T.border }}
      >
      <div
        className="flex items-center gap-2.5 border-b px-[18px] py-4"
        style={{ borderColor: T.border }}
      >
        <span
          className="inline-flex flex-shrink-0 items-center rounded-lg px-2 py-1.5"
          style={{ background: "#0F1623" }}
        >
          <img src="/soulforms-logo-dark.png" alt="SoulForms" className="h-5 object-contain" />
        </span>
        <span className="text-[11px] font-medium" style={{ color: T.textMuted }}>
          Formularios
        </span>
      </div>

      <nav className="flex-1 px-2 py-3">
        {NAV_ITEMS.filter(
          (item) =>
            (!item.adminOnly || currentUser.role === "admin") &&
            (!item.permission || userHasPermission(currentUser, item.permission)),
        ).map((item) => {
          const active = section === item.id;
          return (
            <div
              key={item.id}
              onClick={() => { onSelectSection(item.id); onClose?.(); }}
              className="group relative mb-0.5 flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg px-3.5 py-[11px] transition-all duration-200 ease-out"
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(0,194,168,0.16) 0%, rgba(8,145,178,0.12) 100%)"
                  : "transparent",
                boxShadow: active ? "inset 0 0 0 1px rgba(0,194,168,0.22)" : "none",
              }}
              onMouseOver={(e) => {
                if (!active) e.currentTarget.style.background = T.bgHover;
              }}
              onMouseOut={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-all duration-200"
                style={{
                  background: active
                    ? "linear-gradient(180deg, #00c2a8 0%, #0891b2 100%)"
                    : "transparent",
                }}
              />
              <span
                className="flex items-center transition-colors duration-200"
                style={{ color: active ? ACCENT : T.textMuted }}
              >
                <Icon name={item.icon} size={17} />
              </span>
              <span
                className="text-[13px] transition-colors duration-200"
                style={{
                  fontWeight: active ? 700 : 500,
                  color: active ? ACCENT : T.text,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}

        <div className="my-3 mx-2 h-px" style={{ background: T.border }} />

        <div
          onClick={onSwitchToUserApp}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-[11px] transition-all duration-200 ease-out"
          onMouseOver={(e) => {
            e.currentTarget.style.background = T.bgHover;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span className="flex items-center" style={{ color: T.textMuted }}>
            <Icon name="smartphone" size={17} />
          </span>
          <span className="text-[13px] font-medium" style={{ color: T.text }}>
            Vista App
          </span>
        </div>
      </nav>

      <div className="border-t px-3.5 py-3" style={{ borderColor: T.border }}>
        {/* Chip del usuario: click → modal "Editar mi perfil". El botón
            "Editar" aparece en hover para hacer explícita la acción sin
            saturar visualmente el estado normal. */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="group mb-2.5 flex w-full items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left transition-colors"
          style={{ background: T.bg }}
          onMouseOver={(e) => (e.currentTarget.style.background = T.bgHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = T.bg)}
          title="Editar mi perfil"
        >
          <Avatar name={currentUser.name} size={36} />
          <div className="min-w-0 flex-1">
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold"
              style={{ color: T.textStrong }}
            >
              {currentUser.name}
            </div>
            <div className="text-[10px] capitalize" style={{ color: T.textMuted }}>
              {currentUser.role}
            </div>
          </div>
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: ACCENT, background: "rgba(0,194,168,0.10)" }}
          >
            <Icon name="edit" size={11} />
            Editar
          </span>
        </button>

        <MyTwoFactorButton />

        <button
          onClick={onLogout}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-red-200 bg-transparent px-3.5 py-2 text-xs font-semibold text-red-500 transition-all duration-200 ease-out hover:border-red-500 hover:bg-red-50"
        >
          <Icon name="logout" size={14} /> Cerrar sesión
        </button>

        <div className="text-center text-[10px]" style={{ color: T.textMuted }}>
          SoulForms v1.0
        </div>
      </div>
      </aside>

      {editOpen && <EditMyProfileModal onClose={() => setEditOpen(false)} />}
    </>
  );
}
