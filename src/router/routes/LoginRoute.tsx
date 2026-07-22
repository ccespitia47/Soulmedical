import { useNavigate, useSearchParams } from "react-router-dom";
import Login from "../../pages/Login";
import { useAuthStore } from "../../store/useAuthStore";
import { ROLE_PERMISSIONS, type AuthUser } from "../../types/auth.types";
import type { AppOption } from "../../components/auth/LoginModal";

export default function LoginRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuthUser = useAuthStore((s) => s.setUser);

  const handleLogin = (user: AuthUser, app: AppOption["id"], token: string) => {
    setAuthUser(user, token);

    // Si veníamos de un enlace de descarga de reporte (redirigidos aquí por
    // no estar autenticados), volvemos ahí en vez del dashboard por rol.
    // Safe-list estricta: solo rutas /reports/download/ para evitar un
    // open-redirect si alguien manipula el query param.
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/reports/download/")) {
      navigate(returnTo, { replace: true });
      return;
    }

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