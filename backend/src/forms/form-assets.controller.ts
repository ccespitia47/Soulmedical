import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
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
import { FormAssetsService } from './form-assets.service';

// Shape mínimo de Multer.File que consumimos aquí. Evita depender de
// `@types/multer` (no instalado). Multer runtime viene con
// @nestjs/platform-express, así que los campos existen en tiempo real.
type UploadedMulterFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

const MAX_BYTES = 2 * 1024 * 1024;

@Controller('forms/assets')
export class FormAssetsController {
  constructor(private readonly assets: FormAssetsService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }),
  )
  async upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Req() req: { user: { id: number } },
  ): Promise<{ fileId: string; url: string }> {
    if (!file) throw new BadRequestException('Archivo faltante.');
    const fileId = await this.assets.upload(
      file.buffer,
      file.mimetype,
      Number(req.user.id),
    );
    return { fileId, url: `/api/forms/assets/${fileId}` };
  }

  @Get(':fileId')
  async download(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, contentType, length } =
      await this.assets.openDownload(fileId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
    });
    stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(Permission.FORMS_EDIT)
  @Delete(':fileId')
  @HttpCode(204)
  async remove(@Param('fileId') fileId: string): Promise<void> {
    await this.assets.delete(fileId);
  }
}
