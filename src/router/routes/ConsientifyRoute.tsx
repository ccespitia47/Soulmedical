import { useNavigate } from "react-router-dom";
import Consientify from "../../pages/Consientify";
import { useAuthStore } from "../../store/useAuthStore";
import { clearSession } from "../../services/api";
import { userHasPermission } from "../../types/auth.types";

export default function ConsientifyRoute() {
  const navigate = useNavigate();
  const clearAuthUser = useAuthStore((s) => s.clearUser);
  const user = useAuthStore((s) => s.currentUser);

  const handleLogout = () => {
    clearSession({ redirect: false });
    clearAuthUser();
    navigate("/consientify/login", { replace: true });
  };

  // Bloqueo por permiso: si el usuario está autenticado pero no tiene
  // `consientify_access`, mostramos un mensaje en vez del módulo.
  if (!userHasPermission(user, "consientify_access")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-3 text-5xl">🔒</div>
          <h1 className="m-0 mb-2 text-xl font-bold text-slate-900">
            Acceso restringido
          </h1>
          <p className="m-0 mb-5 text-sm text-slate-500">
            No tienes permiso para acceder a Consientify. Pide a un
            administrador que active el permiso "Acceso a Consientify" en tu
            usuario.
          </p>
          <button
            onClick={handleLogout}
            className="cursor-pointer rounded-lg border-none bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <Consientify onLogout={handleLogout} />;
}
