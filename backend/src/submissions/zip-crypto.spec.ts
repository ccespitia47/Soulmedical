import { encryptedZip } from './zip-crypto';

describe('encryptedZip', () => {
  it('produce un Buffer no vacío con firma PK', async () => {
    const zip = await encryptedZip(
      [
        { name: 'a.txt', buffer: Buffer.from('hola') },
        { name: 'b.txt', buffer: Buffer.from('mundo') },
      ],
      'password123',
    );
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.length).toBeGreaterThan(50);
    // Firma ZIP estándar (PK\003\004)
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });

  it('rechaza si password vacía', async () => {
    await expect(encryptedZip([{ name: 'x', buffer: Buffer.alloc(0) }], '')).rejects.toThrow();
  });
});
