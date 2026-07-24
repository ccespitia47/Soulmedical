// `bulk-pdf.service.ts` importa (transitivamente, vía PdfRendererService)
// el paquete `puppeteer-core`, que se distribuye como ESM puro y que el
// runtime de Jest (a diferencia de Node en producción, que sí soporta
// require(esm) nativo desde 22.12) no puede parsear. Este test solo ejercita
// `renderInBatches` (función pura, sin dependencias de Nest/Puppeteer), así
// que mockeamos el módulo para evitar que Jest intente cargar el archivo
// ESM real al resolver la cadena de imports.
jest.mock('puppeteer-core', () => ({}), { virtual: true });

import { renderInBatches } from './bulk-pdf.service';

describe('renderInBatches', () => {
  it('respeta concurrencia y mantiene orden de resultados', async () => {
    const items = [1, 2, 3, 4, 5];
    const inflight = { count: 0, max: 0 };
    const results = await renderInBatches(items, 2, async (n) => {
      inflight.count++;
      inflight.max = Math.max(inflight.max, inflight.count);
      await new Promise((r) => setTimeout(r, 10));
      inflight.count--;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(inflight.max).toBeLessThanOrEqual(2);
  });

  it('devuelve null en items que fallan sin abortar el resto', async () => {
    const results = await renderInBatches([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(results).toEqual([1, null, 3]);
  });
});
