import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Servicio que convierte un HTML snapshot a PDF usando Puppeteer.
 * El HTML ya tiene los valores del formulario reemplazados — se usa
 * para generar PDFs históricos sin depender del frontend.
 */
@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);

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

  async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const executablePath = this.findChrome();
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    try {
      const page = await browser.newPage();
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

      await page.setContent(fullHtml, { waitUntil: 'load' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}