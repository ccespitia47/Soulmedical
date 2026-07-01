import * as ExcelJS from 'exceljs';
import { encryptXlsxOoxml } from './xlsx-crypto';

describe('encryptXlsxOoxml', () => {
  it('devuelve un buffer distinto al original y no vacio', async () => {
    // Genera un xlsx en claro de referencia
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['a', 'b']);
    ws.addRow([1, 2]);
    const plain = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);

    const encrypted = await encryptXlsxOoxml(plain, 'test-password');

    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(encrypted.equals(plain)).toBe(false);
    // Los xlsx cifrados con OOXML empiezan con la firma OLE Compound
    // File "D0 CF 11 E0 A1 B1 1A E1" (docfile). Los xlsx en claro empiezan
    // con la firma ZIP "PK\x03\x04".
    expect(encrypted.slice(0, 4).toString('hex')).toBe('d0cf11e0');
  });
});
