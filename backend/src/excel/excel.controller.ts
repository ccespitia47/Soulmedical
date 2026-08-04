import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ExcelService } from './excel.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import {
  AdminActionType,
  AdminActionTargetType,
} from '../admin-audit/admin-action.entity';

interface AuthRequest {
  user: { id: number; email?: string; name?: string; role: string };
  ip?: string;
}

/** Helper para extraer el actor del request JWT (mismo criterio que records.controller / users.controller). */
function actorFrom(req: AuthRequest): { id: number; name: string; role: string } {
  return {
    id: Number(req.user.id),
    name: req.user.name ?? req.user.email ?? `user#${req.user.id}`,
    role: req.user.role,
  };
}

/** Trunca strings largos para que quepan en el targetId (varchar 64) / metadata. */
function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Guards a nivel de clase: JWT siempre + PermissionsGuard (que solo
 * bloquea si el handler tiene @RequirePermission). Ver
 * PermissionsGuard.canActivate — si no hay decorador, deja pasar.
 * Asi podemos requerir FORMS_EDIT solo en /headers (builder para admin)
 * y dejar /search accesible a cualquier autenticado.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('excel')
export class ExcelController {
  constructor(
    private readonly excelService: ExcelService,
    private readonly auditService: AdminAuditService,
  ) {}

  /**
   * Devuelve la primera fila (headers) del Excel apuntado por `url`.
   * Usa cache 60s del ExcelService — al pegar la URL en el builder solo
   * la primera vez cuesta ~500ms; siguientes usos son instantáneos.
   *
   * Solo lo usan admins desde el builder al configurar el widget;
   * requiere FORMS_EDIT.
   */
  @Post('headers')
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async headers(
    @Body() body: { url?: string },
    @Request() req: AuthRequest,
  ): Promise<{ headers: string[] }> {
    if (!body?.url?.trim()) {
      throw new BadRequestException('Falta el campo url');
    }
    const url = body.url.trim();
    try {
      const headers = await this.excelService.getHeaders(url);
      // Audit trail (fix I4): Files.Read.All da acceso tenant-wide, dejar
      // huella de cada Excel al que se accede es obligatorio para compliance.
      // Target ID = URL truncada al max del column (64 chars); metadata
      // guarda la URL completa y el conteo de columnas para debugging.
      await this.auditService.log({
        actor: actorFrom(req),
        action: AdminActionType.EXCEL_HEADERS_ACCESSED,
        targetType: AdminActionTargetType.EXCEL_FILE,
        targetId: truncate(url, 64),
        metadata: {
          url: truncate(url, 500),
          headersCount: headers.length,
          ip: req.ip ?? null,
        },
      });
      return { headers };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Error leyendo Excel: ${msg}`);
    }
  }

  /**
   * Búsqueda case-insensitive en el Excel. Devuelve máx. 20 filas que
   * contengan `q` en la columna `searchCol`.
   *
   * Sin @RequirePermission: cualquier usuario autenticado que este
   * llenando un formulario con widget "search" configurado sobre Excel
   * puede consultar. El PermissionsGuard a nivel de clase se auto-desactiva
   * cuando el handler no declara permiso. Throttle bajado a 30/min para
   * mitigar abuso, y cada llamada queda en el audit trail (I4).
   */
  @Post('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(
    @Body() body: { url?: string; q?: string; searchCol?: string },
    @Request() req: AuthRequest,
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (!body?.url?.trim() || !body?.q?.trim() || !body?.searchCol?.trim()) {
      throw new BadRequestException('Faltan campos: url, q, searchCol');
    }
    const url = body.url.trim();
    const q = body.q.trim();
    const searchCol = body.searchCol.trim();
    try {
      const rows = await this.excelService.searchRows(url, q, searchCol);
      // Audit trail (fix I4): permiso mas laxo que /headers, mas razon
      // para dejar huella. metadata.q se guarda truncado.
      await this.auditService.log({
        actor: actorFrom(req),
        action: AdminActionType.EXCEL_SEARCH_PERFORMED,
        targetType: AdminActionTargetType.EXCEL_FILE,
        targetId: truncate(url, 64),
        metadata: {
          url: truncate(url, 500),
          searchCol: truncate(searchCol, 200),
          q: truncate(q, 200),
          resultsCount: rows.length,
          ip: req.ip ?? null,
        },
      });
      return { rows };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Error buscando en Excel: ${msg}`);
    }
  }
}
