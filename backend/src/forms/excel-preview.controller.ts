import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ExcelPreviewService, type CellMapping } from './excel-preview.service';
import { FilesService } from '../files/files.service';

// Shape mínimo del File de Multer — evita depender de `@types/multer`.
type UploadedMulterFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

const MAX_BYTES = 15 * 1024 * 1024;

type FilledPreviewBody = {
  excelBase64: string;
  mappings: CellMapping[];
  values: Record<string, string>;
  customLogoBase64?: string;
  filename?: string;
};

function decodeBase64(dataUriOrRaw: string): Buffer {
  const raw = dataUriOrRaw.includes(',') ? dataUriOrRaw.split(',')[1] : dataUriOrRaw;
  return Buffer.from(raw, 'base64');
}

@Controller('forms/excel')
export class ExcelPreviewController {
  constructor(
    private readonly preview: ExcelPreviewService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Preprocesa los `values` del body: separa los valores que son imágenes
   * (data URL `data:image/...` o referencia GridFS `gridfs:xxx`) de los
   * valores de texto normales. Devuelve el map de imágenes por coord de
   * celda mapeada — se pasa a fillXlsx para anclarlas como imagen en la
   * celda en vez de escribir el data URL / gridfs id como texto.
   */
  private async resolveImageValues(
    mappings: CellMapping[],
    values: Record<string, string>,
  ): Promise<Map<string, { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }>> {
    const out = new Map<string, { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }>();
    for (const m of mappings) {
      const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
      const val = values[key];
      if (typeof val !== 'string') continue;

      // Caso 1: data URL directo (flujo autenticado — el widget signature
      // del cliente entrega la firma como data:image/png;base64,...)
      const dataUrlMatch = /^data:image\/([a-z0-9.+-]+);base64,(.+)$/i.exec(val);
      if (dataUrlMatch) {
        const ext = dataUrlMatch[1].toLowerCase();
        const extension: 'png' | 'jpeg' | 'gif' =
          ext.includes('gif') ? 'gif' :
          ext.includes('jpg') || ext.includes('jpeg') ? 'jpeg' :
          'png';
        try {
          out.set(m.coord, {
            buffer: Buffer.from(dataUrlMatch[2], 'base64'),
            extension,
          });
        } catch {
          /* base64 inválido, ignorar */
        }
        continue;
      }

      // Caso 2: referencia GridFS (flujo público — offloadBinaries ya
      // subió el binario y en la submission queda "gridfs:<id>").
      if (val.startsWith('gridfs:')) {
        const fileId = val.slice('gridfs:'.length);
        try {
          const { buffer, contentType } = await this.filesService.download(fileId);
          const ct = (contentType ?? '').toLowerCase();
          const extension: 'png' | 'jpeg' | 'gif' =
            ct.includes('gif') ? 'gif' :
            ct.includes('jpeg') || ct.includes('jpg') ? 'jpeg' :
            'png';
          out.set(m.coord, { buffer, extension });
        } catch {
          /* archivo no disponible, ignorar */
        }
      }
    }
    return out;
  }

  /**
   * Vista del mapper — sube el .xlsx vacío para mapear celdas.
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('preview-html')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }),
  )
  async previewHtml(
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<{ html: string; css: string }> {
    if (!file) throw new BadRequestException('Archivo faltante.');
    if (file.size === 0) throw new BadRequestException('Archivo vacío.');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 15 MB.');
    }
    return this.preview.convertBufferToHtml(file.buffer);
  }

  /**
   * Preview con placeholders rellenados + logo custom. Devuelve el HTML
   * (para mostrar cómo quedaría el PDF antes de descargar).
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('preview-filled')
  async previewFilled(
    @Body() body: FilledPreviewBody,
  ): Promise<{ html: string; css: string }> {
    if (!body?.excelBase64) throw new BadRequestException('Falta excelBase64.');
    const buf = decodeBase64(body.excelBase64);
    if (buf.length > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 15 MB.');
    }
    const filled = await this.preview.fillXlsx(
      buf,
      body.mappings ?? [],
      body.values ?? {},
      body.customLogoBase64,
    );
    return this.preview.convertBufferToHtml(filled);
  }

  /**
   * Renderiza el PDF final con LibreOffice. Devuelve el PDF binario
   * como attachment para descarga.
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('render-pdf')
  async renderPdf(
    @Body() body: FilledPreviewBody,
    @Res() res: Response,
  ): Promise<void> {
    if (!body?.excelBase64) throw new BadRequestException('Falta excelBase64.');
    const buf = decodeBase64(body.excelBase64);
    if (buf.length > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 15 MB.');
    }
    // Resolver valores tipo data:image/... o gridfs:xxx a buffers → mapa
    // por coord para que fillXlsx los ancle como imagen (firmas, fotos).
    // Sin esto, la firma llegaba como texto literal en la celda.
    const imagesByCoord = await this.resolveImageValues(
      body.mappings ?? [],
      body.values ?? {},
    );
    const filled = await this.preview.fillXlsx(
      buf,
      body.mappings ?? [],
      body.values ?? {},
      body.customLogoBase64,
      imagesByCoord,
    );
    const pdf = await this.preview.convertBufferToPdf(filled);
    const name = (body.filename || 'formulario').replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.end(pdf);
  }
}
