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
  clearUser: () => set({ currentUser: null, token: null }),
}));