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
// Hosts de confianza desde los que el servidor SÍ descargará imágenes (logos)
// para incrustarlas como data: URI en el PDF. Todo lo demás sigue bloqueado por
// el interceptor de Puppeteer (anti-SSRF). Ampliable vía env PDF_IMG_SAFELIST
// (lista separada por comas). Por defecto solo api.moreapp.com (los logos de
// los formatos actuales viven ahí).
const IMG_HOST_SAFELIST = (process.env.PDF_IMG_SAFELIST ?? 'api.moreapp.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB por imagen

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  /**
   * Descarga (solo desde hosts en la safelist) las imágenes referenciadas por
   * <img src="https://..."> y las reemplaza por data: URI base64 en el HTML.
   * Así los logos alojados en dominios de confianza aparecen en el PDF, mientras
   * el interceptor de Puppeteer sigue bloqueando cualquier otra red saliente.
   */
  private async inlineSafelistedImages(html: string): Promise<string> {
    const urls = new Set<string>();
    const imgRe = /<img\b[^>]*?\bsrc=["'](https?:\/\/[^"']+)["']/gi;
    for (const m of html.matchAll(imgRe)) {
      try {
        const host = new URL(m[1]).host.toLowerCase();
        if (IMG_HOST_SAFELIST.includes(host)) urls.add(m[1]);
      } catch {
        /* URL inválida — se ignora */
      }
    }
    if (urls.size === 0) return html;

    const replacements = new Map<string, string>();
    await Promise.all(
      [...urls].map(async (url) => {
        const dataUri = await this.fetchImageAsDataUri(url);
        if (dataUri) replacements.set(url, dataUri);
      }),
    );

    let out = html;
    for (const [url, dataUri] of replacements) {
      out = out.split(url).join(dataUri);
    }
    return out;
  }

  private async fetchImageAsDataUri(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      if (!res.ok) return null;
      // Si un redirect llevó a un host fuera de la safelist, rechazar (evita
      // que un redirect abierto sea un bypass de SSRF).
      const finalHost = new URL(res.url).host.toLowerCase();
      if (!IMG_HOST_SAFELIST.includes(finalHost)) return null;
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!ct.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_IMG_BYTES) return null;
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch (err) {
      this.logger.warn(
        `[pdf-renderer] no se pudo incrustar imagen ${url}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

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
    // Incrusta logos de hosts de confianza como data: URI ANTES de cargar el
    // HTML en Puppeteer (que bloquea toda red saliente). Sin esto, los
    // <img src="https://api.moreapp.com/..."> quedan como imágenes rotas.
    const htmlWithImages = await this.inlineSafelistedImages(html);

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
<body>${htmlWithImages}</body>
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
