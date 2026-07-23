import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { clearSession, getStoredUser, getToken } from "../services/api";
import { ROLE_AVATARS, sanitizePermissions, type AuthUser } from "../types/auth.types";

type AuthRestoreState = {
  ready: boolean;
  user: AuthUser | null;
};

export function useAuthRestore(): AuthRestoreState {
  const setAuthUser = useAuthStore((s) => s.setUser);
  const [state, setState] = useState<AuthRestoreState>({ ready: false, user: null });

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      setState({ ready: true, user: null });
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expired = payload.exp && Date.now() / 1000 > payload.exp;
      if (expired) {
        // No redirect — React Router ya muestra /login al setear user: null.
        clearSession({ redirect: false });
        setState({ ready: true, user: null });
        return;
      }
    } catch {
      clearSession({ redirect: false });
      setState({ ready: true, user: null });
      return;
    }
    const user: AuthUser = {
      ...stored,
      avatar: ROLE_AVATARS[stored.role as AuthUser["role"]] ?? "👤",
      permissions: sanitizePermissions(stored.permissions),
    };
    setAuthUser(user, token); // ← pasar token al store al restaurar sesión
    setState({ ready: true, user });
  }, [setAuthUser]);

  return state;
}