import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelCacheService } from './excel-cache.service';
import { utils, write } from 'xlsx';

describe('ExcelService', () => {
  let svc: ExcelService;
  let cache: ExcelCacheService;
  const tokens = { getAccessToken: jest.fn().mockResolvedValue('fake-token') } as any;

  beforeEach(() => {
    cache = new ExcelCacheService();
    svc = new ExcelService(tokens, cache);
  });

  describe('resolveShareId', () => {
    it('convierte URL de SharePoint a share-id encodeado', () => {
      const url = 'https://empresa.sharepoint.com/:x:/g/personal/user/EXXX';
      const id = svc.resolveShareId(url);
      expect(id).toMatch(/^u!/);
      expect(id).not.toContain('/'); // reemplazado por _
      expect(id).not.toContain('+'); // reemplazado por -
      expect(id).not.toMatch(/=+$/); // sin padding
    });

    it('rechaza URLs de OneDrive personal', () => {
      expect(() => svc.resolveShareId('https://onedrive.live.com/edit?id=x')).toThrow(BadRequestException);
    });

    it('rechaza URLs sin dominio sharepoint.com', () => {
      expect(() => svc.resolveShareId('https://example.com/file.xlsx')).toThrow(BadRequestException);
    });
  });

  describe('parse de headers', () => {
    it('devuelve la primera fila como array de strings', async () => {
      // Crear un xlsx en memoria
      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet([
        ['Nombre', 'Documento', 'Teléfono'],
        ['Ana', '123', '3001'],
      ]);
      utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }));

      // Mock cache para que devuelva el buffer sin llamar Graph
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(buffer);

      const headers = await svc.getHeaders('https://empresa.sharepoint.com/:x:/g/x');
      expect(headers).toEqual(['Nombre', 'Documento', 'Teléfono']);
    });
  });

  describe('search', () => {
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      ['Nombre', 'Documento'],
      ['Ana Torres', 'CC 111'],
      ['Yeimer Alejandro', 'CC 222'],
      ['Yeisi Rodriguez', 'CC 333'],
    ]);
    utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(write(wb, { type: 'buffer', bookType: 'xlsx' }));

    beforeEach(() => {
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(buffer);
    });

    it('filtra case-insensitive por la columna indicada', async () => {
      const rows = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'yei', 'Nombre');
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r['Nombre'])).toEqual(['Yeimer Alejandro', 'Yeisi Rodriguez']);
    });

    it('devuelve array vacío si searchCol no existe en headers', async () => {
      const rows = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'yei', 'ColumnaInexistente');
      expect(rows).toEqual([]);
    });

    it('cap de 20 filas máximo', async () => {
      const wb2 = utils.book_new();
      const rows: string[][] = [['Nombre']];
      for (let i = 0; i < 100; i++) rows.push([`nombre-${i}`]);
      const ws2 = utils.aoa_to_sheet(rows);
      utils.book_append_sheet(wb2, ws2, 'Sheet1');
      const bigBuffer = Buffer.from(write(wb2, { type: 'buffer', bookType: 'xlsx' }));
      jest.spyOn(cache, 'getOrFetch').mockResolvedValue(bigBuffer);

      const out = await svc.searchRows('https://empresa.sharepoint.com/:x:/g/x', 'nombre', 'Nombre');
      expect(out).toHaveLength(20);
    });
  });
});
