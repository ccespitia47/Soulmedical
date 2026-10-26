import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type PdfMapping = {
  placeholder: string;
  x: number;
  y: number;
  page: number;
  fontSize?: number;
};

const DEFAULT_FONT_SIZE = 10;

@Injectable()
export class PdfFillService {
  private readonly logger = new Logger(PdfFillService.name);

  /**
   * Rellena un PDF con texto en las coordenadas mapeadas.
   *
   * IMPORTANTE sobre coordenadas: el frontend guarda x/y con origen
   * TOP-LEFT (así lo devuelve react-pdf en el mapper). pdf-lib usa
   * origen BOTTOM-LEFT. Convertimos con `pdfY = pageHeight - y`
   * y ajustamos por la altura de la fuente para que el texto
   * quede sobre la línea marcada, no por debajo.
   */
  async fillPdf(
    buffer: Buffer,
    mappings: PdfMapping[],
    values: Record<string, string>,
  ): Promise<Uint8Array> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Archivo PDF vacío.');
    }

    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`PDF inválido: ${msg}`);
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();

    for (const m of mappings) {
      if (m.page < 0 || m.page >= pages.length) {
        this.logger.warn(
          `Mapping "${m.placeholder}" apunta a página ${m.page + 1} pero el PDF tiene ${pages.length}. Ignorado.`,
        );
        continue;
      }
      const page = pages[m.page];
      const { height } = page.getSize();
      const fontSize = m.fontSize ?? DEFAULT_FONT_SIZE;

      // Buscamos el valor: si el placeholder viene con ${...}, lo quitamos
      // para probar ambas formas — así funciona sin importar cómo lo
      // guarde el frontend.
      const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
      const value =
        values[m.placeholder] ??
        values[key] ??
        values[`\${${key}}`] ??
        '';

      if (!value) continue;

      // pdf-lib: origen bottom-left. Frontend guarda top-left.
      // Ajustamos también con el fontSize para que la baseline del texto
      // quede en la coordenada marcada, no arriba de ella.
      const pdfY = height - m.y - fontSize;

      try {
        page.drawText(String(value), {
          x: m.x,
          y: pdfY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      } catch (e) {
        this.logger.warn(
          `No se pudo dibujar "${m.placeholder}": ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    try {
      return await pdf.save();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`Error generando PDF: ${msg}`);
    }
  }
}
