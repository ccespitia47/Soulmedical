/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
// Casts a any: los tipos de archiver-zip-encrypted no exportan definiciones.
const archiver = require('archiver');
const archiverZipEncrypted = require('archiver-zip-encrypted');
import { PassThrough } from 'stream';

let formatRegistered = false;
function ensureFormat() {
  if (formatRegistered) return;
  archiver.registerFormat('zip-encrypted', archiverZipEncrypted);
  formatRegistered = true;
}

export async function encryptedZip(
  files: Array<{ name: string; buffer: Buffer }>,
  password: string,
): Promise<Buffer> {
  if (!password) throw new Error('encryptedZip: password vacía');
  ensureFormat();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    const archive = (archiver as any)('zip-encrypted', {
      zlib: { level: 6 },
      encryptionMethod: 'aes256',
      password,
    });
    archive.on('error', reject);
    archive.pipe(stream);
    for (const f of files) archive.append(f.buffer, { name: f.name });
    archive.finalize();
  });
}
