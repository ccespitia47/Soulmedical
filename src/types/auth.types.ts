// ─── Tipos de perfil ─────────────────────────────────────────────────────────

export type UserRole = "admin" | "coordinator" | "user";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  // Solo para usuario externo: carpetas y formularios asignados
  assignments?: {
    folderId: string;
    formIds: string[];
  }[];
};

// ─── Permisos por rol ─────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, {
  canAccessBuilder: boolean;
  canManageFolders: boolean;
  canManageProjects: boolean;
  canManageUsers: boolean;
  canFillForms: boolean;
  canViewSubmissions: boolean;
  hasLimitedAccess: boolean;
}> = {
  admin: {
    canAccessBuilder: true,
    canManageFolders: true,
    canManageProjects: true,
    canManageUsers: true,
    canFillForms: true,
    canViewSubmissions: true,
    hasLimitedAccess: false,
  },
  coordinator: {
    canAccessBuilder: false,
    canManageFolders: false,
    canManageProjects: false,
    canManageUsers: false,
    canFillForms: true,
    canViewSubmissions: true,
    hasLimitedAccess: false,
  },
  user: {
    canAccessBuilder: false,
    canManageFolders: false,
    canManageProjects: false,
    canManageUsers: false,
    canFillForms: true,
    canViewSubmissions: false,
    hasLimitedAccess: true,
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  coordinator: "Coordinador",
  user: "Usuario",
};

export const ROLE_AVATARS: Record<UserRole, string> = {
  admin: "👨‍💼",
  coordinator: "👩‍⚕️",
  user: "👤",
};
