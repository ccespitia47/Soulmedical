import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSION_KEY = 'permission';

/** Marca un endpoint como requeridor de un permiso específico. */
export const RequirePermission = (perm: Permission) =>
  SetMetadata(PERMISSION_KEY, perm);
