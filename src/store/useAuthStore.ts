import { create } from "zustand";
import type { AuthUser } from "../types/auth.types";

interface AuthState {
  currentUser: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser, token?: string) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  token: null,
  setUser: (user, token) => set({ currentUser: user, ...(token !== undefined ? { token } : {}) }),
  clearUser: () => {
    // Limpiar el clipboard del builder al hacer logout. El clipboard puede
    // contener config privado (URLs SharePoint, endpoints SQL, sourceFormId
    // de otro tenant) que no debe heredar el siguiente usuario que entre en
    // esta máquina.
    try {
      localStorage.removeItem("soulforms-widget-clipboard");
    } catch {
      /* localStorage no disponible — no-op */
    }
    set({ currentUser: null, token: null });
  },
}));