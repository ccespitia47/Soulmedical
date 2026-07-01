import type { AuthUser } from "../../types/auth.types";
import { useTheme } from "../../context/ThemeContext";
import logo from "../../assets/Logo_GrupoSoul.png";

export type AdminSection = "formularios" | "plantillas" | "usuarios";

type AdminSidebarProps = {
  section: AdminSection;
  currentUser: Pick<AuthUser, "name" | "role" | "avatar">;
  onSelectSection: (s: AdminSection) => void;
  onSwitchToUserApp: () => void;
  onLogout: () => void;
};

const NAV_ITEMS: { id: AdminSection; icon: string; label: string }[] = [
  { id: "formularios", icon: "📋", label: "Formularios" },
  { id: "plantillas", icon: "📑", label: "Plantillas" },
  { id: "usuarios", icon: "👥", label: "Usuarios" },
];

const ACCENT = "#00c2a8";

export default function AdminSidebar({
  section,
  currentUser,
  onSelectSection,
  onSwitchToUserApp,
  onLogout,
}: AdminSidebarProps) {
  const { T } = useTheme();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex w-[220px] min-h-screen flex-shrink-0 flex-col border-r"
      style={{ background: T.bgElev, borderColor: T.border }}
    >
      <div
        className="flex items-center gap-2.5 border-b px-[18px] py-4"
        style={{ borderColor: T.border }}
      >
        <img src={logo} alt="Grupo Soul" className="h-8 object-contain" />
        <span className="text-[11px] font-medium" style={{ color: T.textMuted }}>
          Formularios
        </span>
      </div>

      <nav className="flex-1 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const active = section === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className="mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-[11px] transition-all duration-150"
              style={{
                background: active ? "#e6faf7" : "transparent",
                borderLeft: `3px solid ${active ? ACCENT : "transparent"}`,
              }}
              onMouseOver={(e) => {
                if (!active) e.currentTarget.style.background = T.bgHover;
              }}
              onMouseOut={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="text-[17px]">{item.icon}</span>
              <span
                className="text-[13px]"
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
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border-l-[3px] border-l-transparent px-3.5 py-[11px] transition-all duration-150"
          onMouseOver={(e) => {
            e.currentTarget.style.background = T.bgHover;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span className="text-[17px]">📱</span>
          <span className="text-[13px] font-medium" style={{ color: T.text }}>
            Vista App
          </span>
        </div>
      </nav>

      <div className="border-t px-3.5 py-3" style={{ borderColor: T.border }}>
        <div
          className="mb-2.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2"
          style={{ background: T.bg }}
        >
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-base">
            {currentUser.avatar}
          </div>
          <div className="min-w-0">
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
        </div>

        <button
          onClick={onLogout}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-red-200 bg-transparent px-3.5 py-2 text-xs font-semibold text-red-500 transition-all duration-150 hover:border-red-500 hover:bg-red-50"
        >
          🚪 Cerrar sesión
        </button>

        <div className="text-center text-[10px]" style={{ color: T.textMuted }}>
          SoulForms v1.0
        </div>
      </div>
    </aside>
  );
}
