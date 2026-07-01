import { useNavigate } from "react-router-dom";
import Consientify from "../../pages/Consientify";
import { useAuthStore } from "../../store/useAuthStore";
import { clearSession } from "../../services/api";

export default function ConsientifyRoute() {
  const navigate = useNavigate();
  const clearAuthUser = useAuthStore((s) => s.clearUser);

  const handleLogout = () => {
    clearSession();
    clearAuthUser();
    navigate("/login", { replace: true });
  };

  return <Consientify onLogout={handleLogout} />;
}
