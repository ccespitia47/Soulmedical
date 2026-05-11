import { create } from "zustand";
import type { AuthUser } from "../types/auth.types";

interface AuthState {
  currentUser: AuthUser | null;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  setUser: (user) => set({ currentUser: user }),
  clearUser: () => set({ currentUser: null }),
}));