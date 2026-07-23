import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Permite el acceso si la petición trae un JWT válido (app web) O una API key
 * válida (Power BI / herramientas externas). Se usa para servir los binarios
 * de firma/foto, accesibles tanto desde la app como desde los consumidores del
 * export que ya están autorizados con la API key.
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) API key (no lanza, devuelve boolean)
    try {
      if (await this.apiKeyGuard.canActivate(context)) return true;
    } catch {
      /* continuar con JWT */
    }
    // 2) JWT (passport lanza UnauthorizedException si falla)
    try {
      return (await this.jwtGuard.canActivate(context)) as boolean;
    } catch {
      return false;
    }
  }
}
