import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, UserRole } from "../types/auth.types";
import { ROLE_AVATARS } from "../types/auth.types";

export type AppUser = AuthUser & {
  password: string;
  createdAt: string;
  active: boolean;
};

export type UserAssignment = {
  folderId: string;
  formIds: string[];
};

interface UsersState {
  users: AppUser[];

  addUser: (data: {
    email: string;
    name: string;
    role: UserRole;
    password: string;
    assignments?: UserAssignment[];
  }) => void;

  updateUser: (id: string, changes: Partial<Omit<AppUser, "id" | "createdAt">>) => void;
  deleteUser: (id: string) => void;
  toggleActive: (id: string) => void;
  updateAssignments: (id: string, assignments: UserAssignment[]) => void;

  // Autenticar usuario externo creado por admin
  authenticateUser: (email: string, password: string) => AppUser | null;
}

export const useUsersStore = create<UsersState>()(
  persist(
    (set, get) => ({
      users: [],

      addUser: (data) => {
        const newUser: AppUser = {
          id: crypto.randomUUID(),
          email: data.email,
          name: data.name,
          role: data.role,
          password: data.password,
          avatar: ROLE_AVATARS[data.role],
          assignments: data.assignments ?? [],
          createdAt: new Date().toLocaleDateString("es-CO"),
          active: true,
        };
        set((state) => ({ users: [...state.users, newUser] }));
      },

      updateUser: (id, changes) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id
              ? { ...u, ...changes, avatar: ROLE_AVATARS[changes.role ?? u.role] }
              : u
          ),
        }));
      },

      deleteUser: (id) => {
        set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
      },

      toggleActive: (id) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, active: !u.active } : u
          ),
        }));
      },

      updateAssignments: (id, assignments) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, assignments } : u
          ),
        }));
      },

      authenticateUser: (email, password) => {
        const user = get().users.find(
          (u) =>
            u.email.toLowerCase() === email.toLowerCase() &&
            u.password === password &&
            u.active
        );
        return user ?? null;
      },
    }),
    { name: "soulforms-users" }
  )
);