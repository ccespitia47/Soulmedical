import { create } from "zustand";
import { getUsersApi } from "../services/api";
import type { UserRole } from "../types/auth.types";
import { ROLE_AVATARS } from "../types/auth.types";

/**
 * Caché en memoria de la lista de usuarios. Hidratado desde el backend
 * vía /api/users. Sin password (la autenticación pasa por JWT) y sin
 * persist (la lista se recarga al inicio para tener datos frescos y
 * evitar guardar credenciales en localStorage).
 */
export type AppUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  active: boolean;
  createdAt: string;
};

interface UsersState {
  users: AppUser[];
  loading: boolean;
  loaded: boolean;
  loadUsers: () => Promise<void>;
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loading: false,
  loaded: false,

  loadUsers: async () => {
    if (get().loading) return;
    set({ loading: true });
    const { data } = await getUsersApi();
    if (data) {
      set({
        users: data.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserRole,
          avatar: ROLE_AVATARS[u.role as UserRole] ?? "👤",
          active: u.isActive,
          createdAt: u.createdAt,
        })),
        loading: false,
        loaded: true,
      });
    } else {
      set({ loading: false, loaded: true });
    }
  },
}));
