import { useState } from "react";
import HomePage from "./HomePage";
import UsersPage from "./UsersPage";
import TemplatesPage from "./TemplatesPage";
import ReportsPage from "./ReportsPage";
import AdminAuditPage from "./AdminAuditPage";
import type { AuthUser } from "../types/auth.types";
import { useTheme } from "../context/ThemeContext";
import AdminSidebar, { type AdminSection } from "../components/admin/AdminSidebar";

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
  const [section, setSection] = useState<AdminSection>("formularios");
  const { T } = useTheme();

  return (
    <div className="flex min-h-screen font-sans" style={{ background: T.bg }}>
      <AdminSidebar
        section={section}
        currentUser={currentUser}
        onSelectSection={setSection}
        onSwitchToUserApp={onSwitchToUserApp}
        onLogout={onLogout}
      />

      <main className="ml-[220px] min-h-screen flex-1" style={{ background: T.bg }}>
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
        {section === "usuarios" && <UsersPage />}
        {section === "auditoria" && <AdminAuditPage />}
        {section === "reportes" && <ReportsPage />}
      </main>
    </div>
  );
}
