import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';

@Controller('submissions/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Sirve el binario (firma/foto) solo a peticiones autenticadas (JWT o API key).
  @UseGuards(JwtOrApiKeyGuard)
  @Get(':fileId')
  async download(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, contentType, length } =
      await this.filesService.openDownload(fileId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(length));
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
    });
    stream.pipe(res);
  }
}
