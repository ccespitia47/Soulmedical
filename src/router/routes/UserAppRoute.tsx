import { useNavigate } from "react-router-dom";
import UserAppPage from "../../pages/UserAppPage";
import { useAuthStore } from "../../store/useAuthStore";
import { clearSession } from "../../services/api";

export default function UserAppRoute() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.currentUser);
  const clearAuthUser = useAuthStore((s) => s.clearUser);
  if (!user) return null;

  const handleLogout = () => {
    clearSession();
    clearAuthUser();
    navigate("/login", { replace: true });
  };

  return (
    <UserAppPage
      user={user}
      onFillForm={(folderId, formId) => navigate(`/form/${folderId}/${formId}`)}
      onLogout={handleLogout}
      onSwitchToAdmin={
        // Admin y coordinador pueden ir al panel: el AdminSidebar filtra
        // qué secciones aparecen según los permisos efectivos del usuario
        // (Formularios siempre; Reportes/Auditoría solo si tienen esos
        // permisos extra). Los usuarios "user" nunca ven el botón.
        user.role === "admin" || user.role === "coordinator"
          ? () => navigate("/admin")
          : undefined
      }
    />
  );
}
