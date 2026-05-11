// ─── Tipos de perfil ─────────────────────────────────────────────────────────

export type UserRole = "admin" | "coordinator" | "user";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
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

const TEMP_USERS: Array<AuthUser & { password: string }> = [
  {
    id: 1,
    email: "admin@soulforms.com",
    name: "Administrador",
    role: "admin",
    avatar: ROLE_AVATARS.admin,
    password: "admin123",
  },
  {
    id: 2,
    email: "coordinacion@soulforms.com",
    name: "Coordinación",
    role: "coordinator",
    avatar: ROLE_AVATARS.coordinator,
    password: "coordinacion123",
  },
  {
    id: 3,
    email: "enfermero@soulforms.com",
    name: "Enfermero",
    role: "user",
    avatar: ROLE_AVATARS.user,
    password: "enfermero123",
  },
];

export function authenticateTemp(email: string, password: string): AuthUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const user = TEMP_USERS.find((tempUser) =>
    (tempUser.email.toLowerCase() === normalizedEmail ||
      tempUser.email.split("@")[0] === normalizedEmail) &&
    tempUser.password === password
  );

  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...authUser } = user;
  return authUser;
}