import { useNavigate } from "react-router-dom";
import AdminLayout from "../../pages/AdminLayout";
import { useAuthStore } from "../../store/useAuthStore";
import { clearSession } from "../../services/api";

export default function AdminRoute() {
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
    <AdminLayout
      currentUser={user}
      onOpenBuilder={(folderId, formId) =>
        navigate(`/builder/${folderId}/${formId}`)
      }
      onOpenForm={(folderId, formId) => navigate(`/form/${folderId}/${formId}`)}
      onSwitchToUserApp={() => navigate("/userapp")}
      onLogout={handleLogout}
    />
  );
}
