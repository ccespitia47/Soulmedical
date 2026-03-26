// ─── Tipos de perfil ─────────────────────────────────────────────────────────

export type UserRole = "admin" | "coordinacion" | "enfermero" | "usuario_externo";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  // Solo para usuario_externo: carpetas y formularios asignados
  assignments?: {
    folderId: string;
    formIds: string[]; // formularios específicos dentro de esa carpeta
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
  hasLimitedAccess: boolean; // usuario_externo
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
  coordinacion: {
    canAccessBuilder: false,
    canManageFolders: false,
    canManageProjects: false,
    canManageUsers: false,
    canFillForms: true,
    canViewSubmissions: true,
    hasLimitedAccess: false,
  },
  enfermero: {
    canAccessBuilder: false,
    canManageFolders: false,
    canManageProjects: false,
    canManageUsers: false,
    canFillForms: true,
    canViewSubmissions: false,
    hasLimitedAccess: false,
  },
  usuario_externo: {
    canAccessBuilder: false,
    canManageFolders: false,
    canManageProjects: false,
    canManageUsers: false,
    canFillForms: true,
    canViewSubmissions: false,
    hasLimitedAccess: true, // solo ve sus formularios asignados
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  coordinacion: "Coordinación",
  enfermero: "Enfermero",
  usuario_externo: "Usuario Externo",
};

export const ROLE_AVATARS: Record<UserRole, string> = {
  admin: "👨‍💼",
  coordinacion: "👩‍⚕️",
  enfermero: "🩺",
  usuario_externo: "👤",
};

// ─── Credenciales temporales (admin y roles internos) ─────────────────────────
// Los usuarios externos se crean desde el panel de administración

const TEMP_CREDENTIALS: Record<string, { password: string; user: AuthUser }> = {
  "bi@sarapacientes.com": {
    password: "admin123",
    user: {
      id: "admin-1",
      email: "bi@sarapacientes.com",
      name: "Administrador",
      role: "admin",
      avatar: "👨‍💼",
    },
  },
  "coordinacion@sarapacientes.com": {
    password: "coord123",
    user: {
      id: "coord-1",
      email: "coordinacion@sarapacientes.com",
      name: "Coordinación",
      role: "coordinacion",
      avatar: "👩‍⚕️",
    },
  },
  "enfermero@sarapacientes.com": {
    password: "enf123",
    user: {
      id: "enf-1",
      email: "enfermero@sarapacientes.com",
      name: "Enfermero",
      role: "enfermero",
      avatar: "🩺",
    },
  },
};

// ─── Función de autenticación ─────────────────────────────────────────────────

export function authenticateTemp(
  email: string,
  password: string
): AuthUser | null {
  const entry = TEMP_CREDENTIALS[email.toLowerCase().trim()];
  if (!entry) return null;
  if (entry.password !== password) return null;
  return entry.user;
}