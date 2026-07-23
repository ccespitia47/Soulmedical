import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import {
  AdminAction,
  AdminActionTargetType,
  AdminActionType,
} from './admin-action.entity';

export type AdminAuditActor = {
  id: number;
  name: string;
  role: string;
};

export type LogAdminActionInput = {
  actor: AdminAuditActor;
  action: AdminActionType;
  targetType: AdminActionTargetType;
  targetId: string | number;
  targetName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdminAuditFilters = {
  actorId?: number;
  action?: AdminActionType;
  targetType?: AdminActionTargetType;
  targetId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAction)
    private readonly repo: Repository<AdminAction>,
  ) {}

  /**
   * Inserta un registro de auditoría. Best-effort: si la inserción falla
   * (BD caída, lock, etc.) NO debemos romper la acción de negocio que se
   * está auditando — solo logueamos el error y seguimos.
   */
  async log(input: LogAdminActionInput): Promise<void> {
    try {
      await this.repo.save({
        action: input.action,
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorRole: input.actor.role,
        targetType: input.targetType,
        targetId: String(input.targetId),
        targetName: input.targetName ?? null,
        metadata: input.metadata ?? null,
      });
    } catch (err) {
      this.logger.error(
        `[audit] no se pudo registrar accion ${input.action} actor=${input.actor.id} target=${input.targetType}:${input.targetId}`,
        err,
      );
    }
  }

  /**
   * Lista paginada y filtrada de acciones, ordenadas por fecha descendente.
   * `total` es el conteo absoluto (sin paginar) para que el frontend pueda
   * mostrar "Página X de Y".
   */
  async findAll(filters: AdminAuditFilters): Promise<{
    data: AdminAction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));

    const where: FindOptionsWhere<AdminAction> = {};
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.targetId) where.targetId = filters.targetId;
    if (filters.from && filters.to) {
      where.createdAt = Between(filters.from, filters.to);
    } else if (filters.from) {
      where.createdAt = Between(filters.from, new Date());
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
