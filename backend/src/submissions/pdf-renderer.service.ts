import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';
import * as fs from 'fs';

/**
 * Servicio que convierte un HTML snapshot a PDF usando Puppeteer.
 * El HTML ya tiene los valores del formulario reemplazados — se usa
 * para generar PDFs históricos sin depender del frontend.
 *
 * Mantiene un único browser Chrome vivo entre renderizados: relanzar
 * Chrome cuesta ~600ms por PDF, insostenible para bulk-pdf de cientos
 * de registros. Cada render abre una page nueva y la cierra al terminar.
 *
 * Endurecimiento anti-SSRF (fix C3): setContent con waitUntil:'domcontentloaded'
 * + timeouts explicitos + request interception que solo permite data: URIs.
 * Cualquier snapshot que contenga <img src="http://..."> o fetch() a URLs
 * externas queda bloqueado — el server no hace requests salientes.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  private findChrome(): string {
    // Rutas comunes de Chrome en Windows
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.CHROME_PATH,
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    throw new Error(
      'No se encontró Chrome. Instala Google Chrome o define CHROME_PATH en .env',
    );
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    // Serializa launches concurrentes: si dos requests entran juntos, sólo
    // uno lanza Chrome y el otro espera al mismo browser.
    if (this.launching) return this.launching;

    const executablePath = this.findChrome();
    this.launching = puppeteer
      .launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      })
      .then((br) => {
        this.browser = br;
        br.on('disconnected', () => {
          if (this.browser === br) this.browser = null;
        });
        return br;
      })
      .finally(() => {
        this.launching = null;
      });
    return this.launching;
  }

  async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Bloquea cualquier navegación que no sea data: URI. El template puede
      // venir con <script>fetch('...')</script> o <img src="http://...">;
      // esto neutraliza SSRF/exfiltración desde el snapshot renderizado.
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:') || url === 'about:blank') {
          req.continue().catch(() => undefined);
        } else {
          req.abort().catch(() => undefined);
        }
      });

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; }
  body { width: 794px; box-sizing: border-box; padding: 2px 0; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${html}</body>
</html>`;

      // domcontentloaded (no 'load') + timeout 10s evita esperar recursos
      // externos bloqueados por el interceptor — no hay red que esperar.
      await page.setContent(fullHtml, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
        timeout: 20_000,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      // Cerrar SOLO la page — el browser se reusa entre renderizados.
      await page.close().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      const br = this.browser;
      this.browser = null;
      await br.close().catch((err) =>
        this.logger.warn(
          `[pdf-renderer] fallo al cerrar Chrome: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }
}
