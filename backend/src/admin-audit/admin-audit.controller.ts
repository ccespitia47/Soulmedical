import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { AdminAuditService } from './admin-audit.service';
import {
  AdminActionTargetType,
  AdminActionType,
} from './admin-action.entity';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  // Requiere permiso AUDIT_VIEW (admin lo tiene por rol; se puede otorgar
  // a otros roles desde el tab Permisos del modal de usuario).
  @RequirePermission(Permission.AUDIT_VIEW)
  @Get()
  list(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll({
      actorId: actorId ? Number(actorId) : undefined,
      // Solo aceptamos valores del enum para evitar inyecciones de strings raros.
      action:
        action && Object.values(AdminActionType).includes(action as AdminActionType)
          ? (action as AdminActionType)
          : undefined,
      targetType:
        targetType &&
        Object.values(AdminActionTargetType).includes(
          targetType as AdminActionTargetType,
        )
          ? (targetType as AdminActionTargetType)
          : undefined,
      targetId: targetId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }
}
