import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';
import type { Readable } from 'stream';

export interface FileMeta {
  kind: 'signature' | 'photo';
  formId: string;
  widgetId: string;
  submittedById?: number | null;
}

export interface DownloadResult {
  stream: Readable;
  contentType: string;
  length: number;
  filename: string;
}

const BUCKET_NAME = 'submission_files';

@Injectable()
export class FilesService {
  private bucketRef: mongo.GridFSBucket | null = null;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get bucket(): mongo.GridFSBucket {
    if (!this.bucketRef) {
      this.bucketRef = new mongo.GridFSBucket(this.connection.db as any, {
        bucketName: BUCKET_NAME,
      });
    }
    return this.bucketRef;
  }

  /**
   * Recibe un data URL ("data:image/png;base64,...."), lo decodifica y lo
   * guarda en GridFS. Devuelve el id del archivo como string, o null si el
   * valor no es un data URL válido.
   */
  async uploadDataUrl(dataUrl: string, meta: FileMeta): Promise<string | null> {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl ?? '');
    if (!match) return null;

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) return null;

    const filename = `${meta.kind}_${meta.widgetId}`;

    return new Promise<string>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(filename, {
        metadata: { ...meta, contentType },
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => resolve(String(uploadStream.id)));
      uploadStream.end(buffer);
    });
  }

  /** Abre el stream de descarga + metadatos para servir el binario. */
  async openDownload(fileId: string): Promise<DownloadResult> {
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(fileId);
    } catch {
      throw new NotFoundException('Archivo no encontrado');
    }

    const files = await this.bucket.find({ _id: oid }).toArray();
    if (files.length === 0) throw new NotFoundException('Archivo no encontrado');

    const file = files[0];
    const contentType =
      (file.metadata as { contentType?: string } | undefined)?.contentType ??
      'application/octet-stream';
    return {
      stream: this.bucket.openDownloadStream(oid),
      contentType,
      length: file.length,
      filename: file.filename,
    };
  }

  /**
   * Wrapper que consume `openDownload` y devuelve el binario como Buffer.
   * Útil para consumidores que necesitan el contenido completo en memoria
   * (interpolador de PDF, generadores de miniaturas, etc.).
   */
  async download(fileId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const { stream, contentType } = await this.openDownload(fileId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return { buffer: Buffer.concat(chunks), contentType };
  }

  async delete(fileId: string): Promise<void> {
    try {
      await this.bucket.delete(new Types.ObjectId(fileId));
    } catch {
      /* archivo ya no existe: nada que hacer */
    }
  }
}
