import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';
import { Readable } from 'stream';

const BUCKET_NAME = 'form_assets';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_PREFIX = 'image/';

export interface AssetDownload {
  stream: Readable;
  contentType: string;
  length: number;
}

@Injectable()
export class FormAssetsService {
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

  async upload(
    buffer: Buffer,
    contentType: string,
    uploadedBy: number,
  ): Promise<string> {
    if (!contentType?.startsWith(ALLOWED_PREFIX)) {
      throw new BadRequestException('Solo se permiten imágenes.');
    }
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Archivo vacío.');
    }
    if (buffer.length > MAX_BYTES) {
      throw new BadRequestException('La imagen supera 2 MB.');
    }

    return new Promise<string>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream('form_asset', {
        metadata: { contentType, uploadedBy, uploadedAt: new Date() },
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => resolve(String(uploadStream.id)));
      uploadStream.end(buffer);
    });
  }

  async openDownload(fileId: string): Promise<AssetDownload> {
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(fileId);
    } catch {
      throw new NotFoundException('Recurso no encontrado');
    }
    const files = await this.bucket.find({ _id: oid }).toArray();
    if (files.length === 0) throw new NotFoundException('Recurso no encontrado');
    const file = files[0];
    const contentType =
      (file.metadata as { contentType?: string } | undefined)?.contentType ??
      'application/octet-stream';
    return {
      stream: this.bucket.openDownloadStream(oid),
      contentType,
      length: file.length,
    };
  }

  async delete(fileId: string): Promise<void> {
    try {
      await this.bucket.delete(new Types.ObjectId(fileId));
    } catch {
      /* ya no existe */
    }
  }
}
