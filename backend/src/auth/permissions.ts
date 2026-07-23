import { UserRole } from '../users/user.entity';

/**
 * Catálogo de permisos granulares. Cada permiso identifica una capacidad
 * específica del sistema (independiente del rol). Los permisos se SUMAN
 * a los que ya da el rol base: no se pueden RESTAR.
 */
export enum Permission {
  CONSIENTIFY_ACCESS = 'consientify_access',
  FORMS_CREATE = 'forms_create',
  FORMS_EDIT = 'forms_edit',
  FORMS_DELETE = 'forms_delete',
  /** Ver "Reporte de acciones" (bitácora de acciones administrativas). */
  AUDIT_VIEW = 'audit_view',
  /** Ver "Reporte" (solicitar envíos de formularios por correo). */
  REPORTS_VIEW = 'reports_view',
}

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

/**
 * Permisos que cada rol tiene POR DEFECTO. Estos no se almacenan en BD
 * (vienen del rol). Los permisos extra por usuario se suman a estos.
 */
export const ROLE_BASE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.CONSIENTIFY_ACCESS,
    Permission.FORMS_CREATE,
    Permission.FORMS_EDIT,
    Permission.FORMS_DELETE,
    Permission.AUDIT_VIEW,
    Permission.REPORTS_VIEW,
  ],
  [UserRole.COORDINATOR]: [],
  [UserRole.USER]: [],
};

/**
 * Devuelve true si el usuario tiene el permiso pedido, ya sea por su rol
 * base o porque se le otorgó explícitamente en `user.permissions`.
 */
export function userHasPermission(
  user: { role: UserRole; permissions?: string[] | null },
  perm: Permission,
): boolean {
  const base = ROLE_BASE_PERMISSIONS[user.role] ?? [];
  if (base.includes(perm)) return true;
  const extra = user.permissions ?? [];
  return extra.includes(perm);
}

/** Devuelve la unión de permisos base + extra. */
export function getEffectivePermissions(user: {
  role: UserRole;
  permissions?: string[] | null;
}): Permission[] {
  const base = ROLE_BASE_PERMISSIONS[user.role] ?? [];
  const extra = (user.permissions ?? []).filter((p): p is Permission =>
    ALL_PERMISSIONS.includes(p as Permission),
  );
  return Array.from(new Set([...base, ...extra]));
}
