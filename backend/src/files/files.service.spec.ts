import { Types } from 'mongoose';
import { PassThrough, Readable } from 'stream';
import { FilesService } from './files.service';

// `FilesService` construye su `GridFSBucket` real de forma perezosa (getter
// `bucket`), a partir de `connection.db`. Para testear la sanitización de
// contentType sin un Mongo real, inyectamos un bucket falso directamente en
// el campo privado `bucketRef` — evita construir el driver real y deja
// `find`/`openUploadStream`/`openDownloadStream` completamente bajo control.
function makeService(fakeBucket: unknown): FilesService {
  const service = new FilesService({ db: {} } as any);
  (service as any).bucketRef = fakeBucket;
  return service;
}

describe('FilesService.readAsDataUrl', () => {
  it('sanitiza un contentType malicioso almacenado en GridFS (fallback application/octet-stream)', async () => {
    const oid = new Types.ObjectId();
    const fakeBucket = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          // Doc de GridFS con metadata manipulada/legado: mime con comillas
          // que, sin sanitizar, escaparía del atributo src="data:...">.
          { _id: oid, metadata: { contentType: 'image/png" onerror=alert(1)' } },
        ]),
      }),
      openDownloadStream: jest.fn().mockReturnValue(Readable.from([Buffer.from('AAAA')])),
    };
    const service = makeService(fakeBucket);

    const result = await service.readAsDataUrl(oid.toString());

    expect(result).not.toBeNull();
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('"');
    expect(result!.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });

  it('conserva un contentType de imagen válido de la whitelist', async () => {
    const oid = new Types.ObjectId();
    const fakeBucket = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: oid, metadata: { contentType: 'image/png' } }]),
      }),
      openDownloadStream: jest.fn().mockReturnValue(Readable.from([Buffer.from('AAAA')])),
    };
    const service = makeService(fakeBucket);

    const result = await service.readAsDataUrl(oid.toString());

    expect(result!.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('normaliza mayúsculas/mixed-case de un mime válido (image/PNG -> image/png)', async () => {
    const oid = new Types.ObjectId();
    const fakeBucket = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: oid, metadata: { contentType: 'image/PNG' } }]),
      }),
      openDownloadStream: jest.fn().mockReturnValue(Readable.from([Buffer.from('AAAA')])),
    };
    const service = makeService(fakeBucket);

    const result = await service.readAsDataUrl(oid.toString());

    expect(result!.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('devuelve null cuando el archivo no existe', async () => {
    const fakeBucket = {
      find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    };
    const service = makeService(fakeBucket);

    const result = await service.readAsDataUrl(new Types.ObjectId().toString());

    expect(result).toBeNull();
  });
});

describe('FilesService.uploadDataUrl', () => {
  function uploadWith(fakeBucket: { openUploadStream: jest.Mock }, dataUrl: string) {
    const service = makeService(fakeBucket);
    return service.uploadDataUrl(dataUrl, { kind: 'signature', formId: 'f1', widgetId: 'w1' });
  }

  it('nunca persiste un mime malicioso: lo normaliza a application/octet-stream antes de guardar', async () => {
    let capturedMetadata: Record<string, unknown> | undefined;
    const uploadStream = new PassThrough() as PassThrough & { id?: Types.ObjectId };
    uploadStream.id = new Types.ObjectId();
    const fakeBucket = {
      openUploadStream: jest.fn((_filename: string, opts: { metadata: Record<string, unknown> }) => {
        capturedMetadata = opts.metadata;
        process.nextTick(() => uploadStream.emit('finish'));
        return uploadStream;
      }),
    };

    // Payload calcado del ataque descrito: mime con comillas que intenta
    // cerrar el atributo `src` cuando luego se re-embebe en el PDF.
    const result = await uploadWith(fakeBucket, 'data:image/png" onerror=alert(1);base64,QQ==');

    expect(result).toBe(String(uploadStream.id));
    expect(capturedMetadata?.contentType).toBe('application/octet-stream');
  });

  it('persiste un mime de imagen válido tal cual (normalizado a minúsculas)', async () => {
    let capturedMetadata: Record<string, unknown> | undefined;
    const uploadStream = new PassThrough() as PassThrough & { id?: Types.ObjectId };
    uploadStream.id = new Types.ObjectId();
    const fakeBucket = {
      openUploadStream: jest.fn((_filename: string, opts: { metadata: Record<string, unknown> }) => {
        capturedMetadata = opts.metadata;
        process.nextTick(() => uploadStream.emit('finish'));
        return uploadStream;
      }),
    };

    await uploadWith(fakeBucket, 'data:image/jpeg;base64,QQ==');

    expect(capturedMetadata?.contentType).toBe('image/jpeg');
  });

  it('devuelve null si el data URL no matchea el patrón esperado', async () => {
    const fakeBucket = { openUploadStream: jest.fn() };
    const result = await uploadWith(fakeBucket, 'not-a-data-url');
    expect(result).toBeNull();
    expect(fakeBucket.openUploadStream).not.toHaveBeenCalled();
  });
});
