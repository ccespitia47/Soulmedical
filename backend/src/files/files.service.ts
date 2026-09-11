import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';
import { Readable } from 'stream';

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

// Whitelist de mimes de imagen que este servicio maneja (firmas/fotos). Todo
// lo demás — incluyendo mimes malformados con comillas/espacios que podrían
// escapar del atributo `src="data:...">` en el HTML del PDF — cae a
// application/octet-stream, que nunca se interpreta como <img>.
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MIME_SHAPE_RE = /^[\w.+-]+\/[\w.+-]+$/;
const FALLBACK_MIME = 'application/octet-stream';

/**
 * Sanitiza un contentType arbitrario (leído de GridFS o recibido del
 * cliente) contra la whitelist de imágenes soportadas. Rechaza cualquier
 * valor que no tenga forma de mime válido (previene inyección de atributos
 * cuando el valor termina embebido en `data:${contentType};base64,...`).
 */
function sanitizeImageMime(contentType: unknown): string {
  const raw = typeof contentType === 'string' ? contentType.trim() : '';
  if (!MIME_SHAPE_RE.test(raw)) return FALLBACK_MIME;
  const lower = raw.toLowerCase();
  return ALLOWED_IMAGE_MIMES.has(lower) ? lower : FALLBACK_MIME;
}

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

    // Sanitiza el mime capturado del data URL entrante: solo se persiste si
    // pertenece a la whitelist de imágenes; cualquier otra cosa (incluyendo
    // mimes con comillas/espacios inyectados) se normaliza antes de guardar,
    // para que nunca lleguen mimes maliciosos a GridFS.
    const contentType = sanitizeImageMime(match[1]);
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

  /**
   * Sube un Buffer arbitrario a GridFS y devuelve el fileId como string.
   * Usado por servicios que necesitan persistir blobs grandes (>16 MB) fuera
   * del documento Mongo — ejemplo: ZIPs cifrados de descarga masiva de PDFs.
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    meta?: Record<string, unknown>,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(filename, {
        metadata: { ...(meta ?? {}), contentType },
      });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => resolve(String(uploadStream.id)));
      Readable.from(buffer).pipe(uploadStream);
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

  /**
   * Lee un archivo de GridFS y lo devuelve como data URL
   * ("data:<contentType>;base64,..."). Acepta una referencia con prefijo
   * "gridfs:" o un id crudo. Devuelve null si el id es inválido, el archivo
   * no existe, o ocurre cualquier error de lectura.
   */
  async readAsDataUrl(ref: string): Promise<string | null> {
    try {
      const idStr = ref.startsWith('gridfs:') ? ref.slice('gridfs:'.length) : ref;
      const oid = new Types.ObjectId(idStr);

      const files = await this.bucket.find({ _id: oid }).toArray();
      if (files.length === 0) return null;
      // Sanitiza el contentType almacenado antes de embeberlo en el data URL:
      // un doc de GridFS con metadata manipulada (o legado, previo a esta
      // whitelist) no debe poder inyectar atributos en el <img> que consume
      // buildConsentPdf.ts.
      const contentType = sanitizeImageMime(
        (files[0].metadata as { contentType?: string } | undefined)?.contentType,
      );

      const chunks: Buffer[] = [];
      const stream = this.bucket.openDownloadStream(oid);
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async delete(fileId: string): Promise<void> {
    try {
      await this.bucket.delete(new Types.ObjectId(fileId));
    } catch {
      /* archivo ya no existe: nada que hacer */
    }
  }
}
