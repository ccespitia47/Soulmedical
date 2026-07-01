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
      onSwitchToAdmin={user.role === "admin" ? () => navigate("/admin") : undefined}
    />
  );
}
