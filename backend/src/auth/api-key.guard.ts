import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiKey, ApiKeyDocument } from '../api-keys/api-key.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    if (!key) return false;
    const found = await this.apiKeyModel.findOne({ key, isActive: true });
    if (!found) return false;

    // Popula req.user con el owner de la key para que los controllers que leen
    // req.user.id (POST /forms → createdById, etc.) funcionen igual que con JWT.
    //
    // Si el owner fue borrado/soft-deleted/inactivado, igual DEJAMOS pasar la
    // request con req.user mínimo (solo id + authSource). Esto preserva la
    // retrocompatibilidad para integraciones legacy (Power BI, scripts) que
    // consumen endpoints que NO leen req.user (ej. GET /forms/:formId/submissions/export).
    // Los endpoints que SÍ necesitan un user válido (POST /forms con
    // PermissionsGuard) van a fallar más adelante con 403, con mensaje claro.
    const owner = await this.usersService
      .findById(found.createdById)
      .catch(() => null);
    if (owner && owner.isActive && !owner.deletedAt) {
      request.user = {
        id: owner.id,
        email: owner.email,
        role: owner.role,
        name: owner.name,
        authSource: 'api_key',
        apiKeyName: found.name,
      };
    } else {
      request.user = {
        id: found.createdById,
        authSource: 'api_key',
        apiKeyName: found.name,
      };
    }
    return true;
  }
}
