import { useNavigate } from "react-router-dom";
import ConsientifyLogin from "../../pages/ConsientifyLogin";
import { useAuthStore } from "../../store/useAuthStore";
import type { AuthUser } from "../../types/auth.types";

export default function ConsientifyLoginRoute() {
  const navigate = useNavigate();
  const setAuthUser = useAuthStore((s) => s.setUser);

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    setAuthUser(user, token);
    navigate("/consientify", { replace: true });
  };

  return (
    <ConsientifyLogin
      onLoginSuccess={handleLoginSuccess}
      onGoForgot={() => navigate("/forgot-password")}
    />
  );
}
