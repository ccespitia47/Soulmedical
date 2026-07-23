import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './permissions.decorator';
import { Permission, userHasPermission } from './permissions';
import { UsersService } from '../users/users.service';

/**
 * Lee el permiso requerido vía @RequirePermission() y, consultando al usuario
 * autenticado en BD, decide si la acción es permitida. Siempre consulta BD
 * para que la revocación de permisos tome efecto sin esperar al re-login.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { id?: number; permissions?: string[] } }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Sesión inválida');

    const user = await this.usersService.findById(Number(userId));
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    if (!userHasPermission(user, required)) {
      throw new ForbiddenException(
        'No tienes el permiso necesario para esta acción',
      );
    }
    // adjunta para uso downstream si hace falta
    if (req.user) req.user.permissions = user.permissions ?? [];
    return true;
  }
}
