import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from '../files/files.service';

// Shape mínimo de Multer.File que consumimos aquí. Evita depender de
// `@types/multer` (no instalado). Multer runtime viene con
// @nestjs/platform-express, así que los campos existen en tiempo real.
type UploadedMulterFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

// Cap generoso pero no infinito: 200 MB cubre videos de tramo largo en
// calidad media sin exponer el bucket a subidas absurdas. El bucket es el
// mismo `submission_files` que ya usan signature/photo.
const MAX_BYTES = 200 * 1024 * 1024;

@Controller('submissions/uploads')
export class SubmissionUploadsController {
  constructor(private readonly files: FilesService) {}

  /**
   * Subida pública para widgets `file`/`video` en formularios que puede
   * responder un usuario NO autenticado (public forms, task share links).
   * Devuelve el fileId — el widget lo guarda como `gridfs:<id>` en el
   * hidden input y el submit lo reenvía sin reprocesar (submissions.service
   * detecta el prefijo).
   *
   * Sin auth por diseño (el usuario final no tiene JWT). El throttle limita
   * abuso y el tamaño se acota en Multer + en la validación del service.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }),
  )
  async upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<{ fileId: string; contentType: string; size: number }> {
    if (!file) throw new BadRequestException('Archivo faltante.');
    if (file.size === 0) throw new BadRequestException('Archivo vacío.');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('El archivo supera 200 MB.');
    }
    const fileId = await this.files.uploadBuffer(
      file.buffer,
      file.originalname || 'user_upload',
      file.mimetype || 'application/octet-stream',
      { kind: 'user_upload', originalName: file.originalname },
    );
    return { fileId, contentType: file.mimetype, size: file.size };
  }

  /**
   * Borrado público — el usuario cambió de opinión antes de enviar el
   * formulario y quita el archivo. Best-effort: si el id no existe no
   * pasa nada. Throttle idéntico al upload.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Delete(':fileId')
  @HttpCode(204)
  async remove(@Param('fileId') fileId: string): Promise<void> {
    await this.files.delete(fileId);
  }
}
