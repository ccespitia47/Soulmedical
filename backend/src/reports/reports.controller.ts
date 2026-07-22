import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('forms')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Solicita el reporte de envíos del formulario. El backend genera el .xlsx,
   * lo cifra con OOXML AES-256 (contraseña = documentNumber del usuario),
   * guarda el blob en Mongo con TTL 2 min, y envía por correo un enlace
   * único de descarga que requiere autenticación + 2FA para consumirse.
   *
   * El archivo NUNCA viaja adjunto por correo. La única forma de obtenerlo
   * es abriendo el enlace desde la app autenticada y superando 2FA.
   */
  @RequirePermission(Permission.REPORTS_VIEW)
  @Post(':formId/submissions/export-email')
  async requestReportByEmail(
    @Param('formId') formId: string,
    @Body() body: { fieldIds: string[] },
    @Req() req: { user: { id: number } },
  ) {
    try {
      return await this.reportsService.exportSubmissionsAndEmail(
        Number(req.user.id),
        formId,
        Array.isArray(body?.fieldIds) ? body.fieldIds : [],
      );
    } catch (err) {
      // Re-lanzamos errores HTTP conocidos (403 sin documento, 404 form
      // inexistente, etc.) sin envolverlos: ya tienen mensaje amigable.
      if (err instanceof HttpException) throw err;
      // Cualquier otro error (excel/zip/graph) lo logueamos y devolvemos su
      // mensaje real al cliente para poder diagnosticar en el navegador.
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[requestReportByEmail] userId=${req.user.id} formId=${formId} error=${message}`,
        stack,
      );
      throw new InternalServerErrorException(
        `Error generando el reporte: ${message}`,
      );
    }
  }
}
