import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { PdfFillService, type PdfMapping } from './pdf-fill.service';

const MAX_BYTES = 15 * 1024 * 1024;

type FilledPdfBody = {
  pdfBase64: string;
  mappings: PdfMapping[];
  values: Record<string, string>;
  filename?: string;
};

function decodeBase64(dataUriOrRaw: string): Buffer {
  const raw = dataUriOrRaw.includes(',') ? dataUriOrRaw.split(',')[1] : dataUriOrRaw;
  return Buffer.from(raw, 'base64');
}

/**
 * Endpoints para llenar/previsualizar/descargar el PDF adjunto del email
 * con los mapeos de placeholders del formulario. Espeja los tres endpoints
 * que ya existen para Excel (preview-html, preview-filled, render-pdf).
 */
@Controller('forms/pdf')
export class PdfFillController {
  constructor(private readonly pdfFill: PdfFillService) {}

  /**
   * Devuelve el PDF llenado como data URI base64. El frontend lo carga
   * con react-pdf para mostrarlo en el modal de preview.
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('preview')
  async preview(
    @Body() body: FilledPdfBody,
  ): Promise<{ pdfBase64: string }> {
    if (!body?.pdfBase64) throw new BadRequestException('Falta pdfBase64.');
    const buf = decodeBase64(body.pdfBase64);
    if (buf.length > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 15 MB.');
    }
    const filled = await this.pdfFill.fillPdf(
      buf,
      body.mappings ?? [],
      body.values ?? {},
    );
    const b64 = Buffer.from(filled).toString('base64');
    return { pdfBase64: `data:application/pdf;base64,${b64}` };
  }

  /**
   * Devuelve el PDF llenado como archivo binario para descarga.
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('render')
  async render(
    @Body() body: FilledPdfBody,
    @Res() res: Response,
  ): Promise<void> {
    if (!body?.pdfBase64) throw new BadRequestException('Falta pdfBase64.');
    const buf = decodeBase64(body.pdfBase64);
    if (buf.length > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 15 MB.');
    }
    const filled = await this.pdfFill.fillPdf(
      buf,
      body.mappings ?? [],
      body.values ?? {},
    );
    const name = (body.filename || 'formulario').replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(filled.length));
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.end(Buffer.from(filled));
  }
}
