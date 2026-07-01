import { useNavigate } from "react-router-dom";
import Login from "../../pages/Login";
import { useAuthStore } from "../../store/useAuthStore";
import { ROLE_PERMISSIONS, type AuthUser } from "../../types/auth.types";

export default function LoginRoute() {
  const navigate = useNavigate();
  const setAuthUser = useAuthStore((s) => s.setUser);

  const handleLogin = (user: AuthUser, app: "soulforms" | "consientify") => {
    setAuthUser(user);
    if (app === "consientify") {
      navigate("/consientify");
      return;
    }
    const perms = ROLE_PERMISSIONS[user.role];
    navigate(perms.canManageProjects ? "/admin" : "/userapp");
  };

  return (
    <Login
      onLogin={handleLogin}
      onGoRegister={() => navigate("/register")}
      onGoForgot={() => navigate("/forgot-password")}
    />
  );
}
