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
 * Permisos que NUNCA se pueden ejercer desde una API key, aunque el owner de
 * la key los tenga. Defensa en profundidad: los endpoints DELETE ya exigen JWT
 * explícito, pero si mañana alguien monta un endpoint con JwtOrApiKeyGuard que
 * requiera uno de estos permisos, esta lista cierra el loop.
 */
const API_KEY_FORBIDDEN_PERMISSIONS: Permission[] = [
  Permission.FORMS_DELETE,
];

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

    const req = context.switchToHttp().getRequest<{
      user?: {
        id?: number;
        permissions?: string[];
        authSource?: 'jwt' | 'api_key';
      };
    }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Sesión inválida');

    // Blindaje: una API key no puede ejercer permisos destructivos, pase lo
    // que pase. Si mañana cambia el guard de un endpoint y queda expuesto a
    // API key, este filtro lo bloquea antes de llegar al servicio.
    if (
      req.user?.authSource === 'api_key' &&
      API_KEY_FORBIDDEN_PERMISSIONS.includes(required)
    ) {
      throw new ForbiddenException(
        `El permiso "${required}" no se puede ejercer vía API key; usa una sesión de usuario.`,
      );
    }

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
