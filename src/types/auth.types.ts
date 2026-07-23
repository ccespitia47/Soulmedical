// ─── Tipos de perfil ─────────────────────────────────────────────────────────

export type UserRole = "admin" | "coordinator" | "user";

// ─── Permisos granulares ─────────────────────────────────────────────────────
// Catálogo idéntico al del backend (backend/src/auth/permissions.ts).
// Si se modifica aquí, hay que sincronizar el backend.

export type Permission =
  | "consientify_access"
  | "forms_create"
  | "forms_edit"
  | "forms_delete"
  | "audit_view"
  | "reports_view";

export const ALL_PERMISSIONS: Permission[] = [
  "consientify_access",
  "forms_create",
  "forms_edit",
  "forms_delete",
  "audit_view",
  "reports_view",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  consientify_access: "Acceso a Consientify",
  forms_create: "Crear formularios",
  forms_edit: "Editar formularios",
  forms_delete: "Eliminar formularios",
  audit_view: "Ver reporte de acciones",
  reports_view: "Solicitar reportes de formularios",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  consientify_access: "Permite ingresar al módulo Consientify.",
  forms_create: "Permite crear nuevos formularios.",
  forms_edit: "Permite modificar formularios existentes.",
  forms_delete: "Permite eliminar formularios.",
  audit_view:
    "Permite ver la bitácora de acciones administrativas (Reporte de acciones).",
  reports_view:
    "Permite solicitar los envíos de un formulario por correo como ZIP cifrado.",
};

/**
 * Permisos que cada rol tiene por defecto. Debe espejar el catálogo del
 * backend (ROLE_BASE_PERMISSIONS en auth/permissions.ts).
 */
export const ROLE_BASE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "consientify_access",
    "forms_create",
    "forms_edit",
    "forms_delete",
    "audit_view",
    "reports_view",
  ],
  coordinator: [],
  user: [],
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  /** Permisos efectivos = rol base + extras explícitos. Vienen del backend. */
  permissions?: Permission[];
  assignments?: {
    folderId: string;
    formIds: string[];
  }[];
};

/**
 * Filtra una lista cualquiera dejando solo permisos válidos del catálogo.
 * Útil al construir AuthUser desde una respuesta JSON (string[] → Permission[]).
 */
export function sanitizePermissions(input: readonly unknown[] | undefined): Permission[] {
  if (!input) return [];
  return input.filter((p): p is Permission =>
    typeof p === "string" && (ALL_PERMISSIONS as string[]).includes(p),
  );
}

/**
 * Devuelve true si el usuario tiene el permiso pedido. Mismo criterio que
 * el backend: suma de rol base + permisos explícitos del usuario.
 */
export function userHasPermission(
  user: { role: UserRole; permissions?: Permission[] } | null | undefined,
  perm: Permission,
): boolean {
  if (!user) return false;
  if ((user.permissions ?? []).includes(perm)) return true;
  return ROLE_BASE_PERMISSIONS[user.role]?.includes(perm) ?? false;
}

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