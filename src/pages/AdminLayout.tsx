import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import HomePage from "./HomePage";
import UsersPage from "./UsersPage";
import TemplatesPage from "./TemplatesPage";
import ReportsPage from "./ReportsPage";
import AdminAuditPage from "./AdminAuditPage";
import ApiKeysPage from "./ApiKeysPage";
import type { AuthUser } from "../types/auth.types";
import { useTheme } from "../context/ThemeContext";
import AdminSidebar, { type AdminSection } from "../components/admin/AdminSidebar";
import Icon from "../components/common/Icon";

const VALID_SECTIONS: AdminSection[] = [
  "formularios",
  "plantillas",
  "usuarios",
  "auditoria",
  "reportes",
  "api_keys",
];

type AdminLayoutProps = {
  // Pasamos también `permissions` para que el sidebar pueda filtrar items
  // segun rol base + permisos extras del usuario logueado.
  currentUser: Pick<AuthUser, "name" | "role" | "avatar" | "permissions">;
  onOpenBuilder: (folderId: string, formId: string) => void;
  onOpenForm: (folderId: string, formId: string) => void;
  onSwitchToUserApp: () => void;
  onLogout: () => void;
};

export default function AdminLayout({
  currentUser,
  onOpenBuilder,
  onOpenForm,
  onSwitchToUserApp,
  onLogout,
}: AdminLayoutProps) {
  // section vive en la URL (?section=reportes) para que al refrescar el
  // navegador la pestaña se preserve. Antes era useState local y siempre
  // volvía a "formularios" tras F5.
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("section") as AdminSection | null;
  const section: AdminSection = raw && VALID_SECTIONS.includes(raw) ? raw : "formularios";

  const setSection = useCallback(
    (next: AdminSection) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "formularios") params.delete("section");
          else params.set("section", next);
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { T } = useTheme();

  return (
    <div className="flex min-h-screen font-sans" style={{ background: T.bg }}>
      <AdminSidebar
        section={section}
        currentUser={currentUser}
        onSelectSection={setSection}
        onSwitchToUserApp={onSwitchToUserApp}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Botón flotante para abrir el menú admin en móvil (esquina inferior
          izquierda, no choca con los headers ni con el menú de proyectos). */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú de administración"
          className="fixed bottom-4 left-4 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_10px_24px_-6px_rgba(0,194,168,0.7)] transition-transform hover:scale-105 active:scale-95 lg:hidden"
        >
          <Icon name="menu" size={22} />
        </button>
      )}

      <main className="min-h-screen flex-1 lg:ml-[220px]" style={{ background: T.bg }}>
        {section === "formularios" && (
          <HomePage
            onOpenBuilder={onOpenBuilder}
            onOpenForm={onOpenForm}
            currentUser={currentUser}
          />
        )}
        {section === "plantillas" && (
          <TemplatesPage
            onUseTemplate={(_widgets, folderId, formId) => onOpenBuilder(folderId, formId)}
            currentUser={currentUser}
          />
        )}
        {section === "usuarios" && currentUser.role === "admin" && <UsersPage />}
        {section === "usuarios" && currentUser.role !== "admin" && (
          <div className="mx-auto max-w-lg px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              No tienes permiso para acceder a la gestión de usuarios.
            </p>
          </div>
        )}
        {section === "auditoria" && <AdminAuditPage />}
        {section === "reportes" && <ReportsPage />}
        {section === "api_keys" && currentUser.role === "admin" && <ApiKeysPage />}
        {section === "api_keys" && currentUser.role !== "admin" && (
          <div className="mx-auto max-w-lg px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              No tienes permiso para gestionar API keys.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
