import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ExcelService } from './excel.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  /**
   * Devuelve la primera fila (headers) del Excel apuntado por `url`.
   * Usa cache 60s del ExcelService — al pegar la URL en el builder solo
   * la primera vez cuesta ~500ms; siguientes usos son instantáneos.
   */
  @Post('headers')
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async headers(@Body() body: { url?: string }): Promise<{ headers: string[] }> {
    if (!body?.url?.trim()) {
      throw new InternalServerErrorException('Falta el campo url');
    }
    try {
      const headers = await this.excelService.getHeaders(body.url.trim());
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
   */
  @Post('search')
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async search(
    @Body() body: { url?: string; q?: string; searchCol?: string },
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (!body?.url?.trim() || !body?.q?.trim() || !body?.searchCol?.trim()) {
      throw new InternalServerErrorException('Faltan campos: url, q, searchCol');
    }
    try {
      const rows = await this.excelService.searchRows(
        body.url.trim(),
        body.q.trim(),
        body.searchCol.trim(),
      );
      return { rows };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Error buscando en Excel: ${msg}`);
    }
  }
}
