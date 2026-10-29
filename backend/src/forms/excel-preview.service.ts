import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import * as ExcelJS from 'exceljs';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

const execFileP = promisify(execFile);

export type CellMapping = {
  coord: string;
  placeholder: string;
};

function resolveSofficePath(): string {
  if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  }
  return '/usr/bin/soffice';
}

@Injectable()
export class ExcelPreviewService {
  private readonly logger = new Logger(ExcelPreviewService.name);
  private readonly sofficePath = resolveSofficePath();

  /**
   * Convierte un XLSX (buffer) a HTML fiel usando LibreOffice headless.
   * Post-procesa el HTML resultante inyectando `data-coord="A1"` en cada
   * <td> y embebe las imágenes que LO exportó como archivos aparte
   * (drawings) como data URIs para que se muestren en el shadow DOM del
   * mapper sin cross-origin.
   */
  async convertXlsxToAnnotatedHtml(buffer: Buffer): Promise<{
    html: string;
    css: string;
  }> {
    if (!fs.existsSync(this.sofficePath)) {
      throw new InternalServerErrorException(
        `LibreOffice no está instalado o no se encuentra en ${this.sofficePath}. ` +
          `Instalá LibreOffice o definí la variable de entorno SOFFICE_PATH.`,
      );
    }
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Archivo Excel vacío.');
    }

    const jobId = randomBytes(8).toString('hex');
    const workDir = path.join(os.tmpdir(), `soulforms-xlsx-${jobId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inputPath = path.join(workDir, 'input.xlsx');
    // Perfil de usuario aislado — sin esto, dos conversiones en paralelo
    // chocan con "another instance is already running".
    const userProfileArg = `-env:UserInstallation=file:///${workDir.replace(/\\/g, '/')}/profile`;

    try {
      fs.writeFileSync(inputPath, buffer);

      // Usamos el filtro `html` a secas: LibreOffice detecta el tipo de
      // documento (Calc) y aplica el exporter correcto (HTML de Calc, no
      // el de Writer que teníamos antes y generaba HTML sin <table>).
      await execFileP(
        this.sofficePath,
        [
          userProfileArg,
          '--headless',
          '--convert-to',
          'html',
          '--outdir',
          workDir,
          inputPath,
        ],
        { timeout: 90_000 },
      );

      const producedHtml = path.join(workDir, 'input.html');
      if (!fs.existsSync(producedHtml)) {
        throw new InternalServerErrorException(
          'LibreOffice no generó el HTML esperado (input.html no existe en el workDir).',
        );
      }

      const rawHtml = fs.readFileSync(producedHtml, 'utf8');
      // Diagnóstico temporal — nos dice si LibreOffice generó tabla real
      // o algo distinto cuando corre bajo el proceso del backend.
      const hasTable = /<table\b/i.test(rawHtml);
      this.logger.log(
        `LibreOffice generó HTML de ${rawHtml.length} chars — hasTable=${hasTable}`,
      );
      if (!hasTable) {
        this.logger.warn(
          `HTML crudo sin <table>. Primeros 400 chars: ${rawHtml.slice(0, 400)}`,
        );
      }
      // Las imágenes vienen como archivos separados junto al HTML —
      // reemplazamos los <img src="foo.png"> por data URIs para que el
      // shadow DOM las muestre sin cross-origin.
      const inlinedHtml = this.inlineImages(rawHtml, workDir);
      return this.postProcess(inlinedHtml);
    } catch (e) {
      this.logger.error(`Fallo la conversión XLSX→HTML: ${(e as Error).message}`);
      if (
        e instanceof BadRequestException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      throw new InternalServerErrorException(
        `Error en la conversión con LibreOffice: ${(e as Error).message}`,
      );
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* limpieza best-effort */
      }
    }
  }

  /**
   * Reemplaza cada `<img src="archivo.png">` por su data URI leyendo el
   * archivo del `workDir`. Aplicable a PNG/JPEG/GIF; para EMF (formato
   * nativo de Windows que LO exporta a veces) usamos base64 con MIME
   * `image/emf` pero el browser NO lo puede renderizar — igualmente lo
   * dejamos codificado, en el peor caso se ve el alt/frame vacío.
   */
  private inlineImages(html: string, workDir: string): string {
    return html.replace(/<img\b([^>]*?)\ssrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (match, pre, quote, src, post) => {
      if (src.startsWith('data:') || src.startsWith('http')) return match;
      const localPath = path.join(workDir, src);
      if (!fs.existsSync(localPath)) return match;
      try {
        const buf = fs.readFileSync(localPath);
        const ext = (src.split('.').pop() || '').toLowerCase();
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'gif'
                ? 'image/gif'
                : ext === 'svg'
                  ? 'image/svg+xml'
                  : ext === 'emf'
                    ? 'image/emf'
                    : 'application/octet-stream';
        const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
        return `<img${pre} src="${dataUri}"${post}>`;
      } catch {
        return match;
      }
    });
  }

  private postProcess(rawHtml: string): { html: string; css: string } {
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(rawHtml);
    const css = styleMatch ? styleMatch[1] : '';

    const tableMatch = /<table[^>]*>[\s\S]*?<\/table>/i.exec(rawHtml);
    if (!tableMatch) {
      return {
        html:
          '<p style="padding:20px;color:#94a3b8">La primera hoja del archivo no contiene una tabla.</p>',
        css,
      };
    }
    return { html: this.annotateCoords(tableMatch[0]), css };
  }

  private annotateCoords(tableHtml: string): string {
    // Grid de "casillas ocupadas por merges anteriores" para saber el col
    // real de cada <td> cuando la fila tiene celdas mergeadas verticalmente.
    const occupied = new Map<number, Set<number>>();
    const getOcc = (r: number): Set<number> => {
      let s = occupied.get(r);
      if (!s) {
        s = new Set();
        occupied.set(r, s);
      }
      return s;
    };

    let row = 0;
    let out = '';
    let idx = 0;
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;

    while ((m = rowRe.exec(tableHtml)) !== null) {
      // Copiar todo lo previo al <tr> tal cual (thead, colgroup, etc.)
      // y luego la apertura de la <tr> hasta el >.
      out += tableHtml.slice(idx, m.index);
      const openEnd = tableHtml.indexOf('>', m.index) + 1;
      out += tableHtml.slice(m.index, openEnd);
      row += 1;
      const rowContent = m[1];
      const occRow = getOcc(row);
      let col = 0;

      let processed = '';
      let cellIdx = 0;
      const cellRe = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rowContent)) !== null) {
        processed += rowContent.slice(cellIdx, cm.index);
        const tag = cm[1];
        const attrs = cm[2];
        const inner = cm[3];

        col += 1;
        while (occRow.has(col)) col += 1;

        const colspan = this.parseSpanAttr(attrs, 'colspan');
        const rowspan = this.parseSpanAttr(attrs, 'rowspan');

        const coord = `${this.colLetter(col)}${row}`;
        // Hoy todas las celdas son mappables, salvo las que contienen una
        // imagen (típicamente el logo del Excel): mapear ahí no tiene
        // sentido y el fillXlsx no sabe reemplazar un `<img>` por texto.
        // Antes exigíamos celda vacía, pero eso bloqueaba celdas con
        // placeholders textuales ("Campo abierto...", "Desplegable
        // con...") que son precisamente las que el admin quiere mapear.
        const hasImage = /<img\b/i.test(inner);
        const mappable = !hasImage;

        const newAttrs = `${attrs} data-coord="${coord}"${mappable ? ' data-mappable="true"' : ''}`;
        processed += `<${tag}${newAttrs}>${inner}</${tag}>`;

        for (let dr = 0; dr < rowspan; dr++) {
          const rr = row + dr;
          const oo = getOcc(rr);
          for (let dc = 0; dc < colspan; dc++) {
            oo.add(col + dc);
          }
        }
        col += colspan - 1;
        cellIdx = cm.index + cm[0].length;
      }
      processed += rowContent.slice(cellIdx);
      out += processed + '</tr>';
      idx = m.index + m[0].length;
    }
    out += tableHtml.slice(idx);
    return out;
  }

  private parseSpanAttr(attrs: string, name: string): number {
    const m = new RegExp(`${name}\\s*=\\s*['"]?(\\d+)`, 'i').exec(attrs);
    if (!m) return 1;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  private colLetter(col: number): string {
    let s = '';
    let n = col;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /**
   * Si la celda `coord` (ej "F29") es parte de un merge, devuelve el
   * rango extremo del merge (endRow/endCol 1-based). Sino, devuelve null.
   *
   * ExcelJS no expone una API pública para leer merges — usamos el objeto
   * `_merges` interno (propiedad privada estable en las versiones actuales).
   * Cada valor es un Range con `top`, `left`, `bottom`, `right` en base-1.
   */
  private findMergeForCell(
    ws: ExcelJS.Worksheet,
    coord: string,
  ): { endRow: number; endCol: number } | null {
    const merges = (ws as unknown as { _merges?: Record<string, unknown> })._merges;
    if (!merges) return null;
    const cell = ws.getCell(coord);
    const row = Number(cell.row);
    const col = Number(cell.col);
    for (const key of Object.keys(merges)) {
      const range = merges[key] as {
        top?: number;
        left?: number;
        bottom?: number;
        right?: number;
      };
      const top = range.top ?? -1;
      const left = range.left ?? -1;
      const bottom = range.bottom ?? -1;
      const right = range.right ?? -1;
      if (row >= top && row <= bottom && col >= left && col <= right) {
        return { endRow: bottom, endCol: right };
      }
    }
    return null;
  }

  private isCellEmpty(inner: string): boolean {
    const stripped = inner
      .replace(/<img\b/gi, '__IMG__')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .replace(/\s+/g, '')
      .trim();
    // Si tiene una <img> no lo consideramos "vacío" para no marcarla como
    // mappeable (típicamente es la celda del logo).
    return stripped.length === 0 || stripped === '__IMG__';
  }

  /**
   * Aplica ediciones de texto a celdas del XLSX. `edits` mapea coord → texto
   * nuevo (string vacío ⇒ blanquear la celda). No toca formato, bordes,
   * imágenes ni anchos — sólo el `value` de cada celda listada. Devuelve
   * el buffer del .xlsx modificado.
   *
   * Lo usa el mapper del admin para que el usuario corrija textos sueltos
   * (ej. "Campo abierto (Describir el evento)" → "Descripción:") sin tener
   * que bajar el Excel, editarlo en Office y re-subirlo.
   */
  async editCells(
    buffer: Buffer,
    edits: Record<string, string>,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('El XLSX no tiene hojas.');

    for (const [coord, text] of Object.entries(edits)) {
      // Validación mínima: coord con formato A1, AB123, etc. Si viene algo
      // raro ("1A", "", "Sheet1!A1"), lo ignoramos silenciosamente para no
      // romper el batch entero por una entry mal formada.
      if (!/^[A-Z]{1,3}\d{1,7}$/.test(coord)) continue;
      const cell = ws.getCell(coord);
      // Preserva el style de la celda — exceljs cambia solo el value.
      // Un string vacío queda como celda vacía (value=null) para no dejar
      // el string literal "" que después se ve raro en el preview.
      cell.value = text === '' ? null : text;
    }

    const out = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    return out;
  }

  // ─── Preview con placeholders rellenados + logo custom ─────────────────

  /**
   * Rellena el XLSX (con exceljs) reemplazando cada celda mapeada por su
   * valor y opcionalmente sustituye el logo embebido por `customLogoBase64`.
   * Devuelve un buffer con el .xlsx modificado listo para convertir a
   * HTML o PDF con LibreOffice.
   */
  async fillXlsx(
    buffer: Buffer,
    mappings: CellMapping[],
    values: Record<string, string>,
    customLogoBase64?: string,
    /**
     * Imágenes a incrustar en celdas mapeadas (firmas, fotos). Map de
     * `coord → { buffer, extension }`. Si un mapping tiene entry acá, en
     * vez de escribir texto en la celda insertamos la imagen anclada a
     * esa celda. Sin esto, valores como `gridfs:xxx` salían como texto
     * literal en el PDF (el "6b59a22108" que Sara vio en el pie de firma).
     */
    imagesByCoord?: Map<
      string,
      { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }
    >,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    // ExcelJS acepta Buffer directo — no requiere ArrayBuffer.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('El XLSX no tiene hojas.');

    // Rellenar cada celda mapeada con el valor correspondiente.
    // Alignment: el patrón común de estos Excel es "Label ______________" —
    // celda mergeada con borde inferior (línea de firma). Por default los
    // valores caen centrados y quedan "flotando" en el medio del renglón,
    // que se ve horrible. Forzamos alineación inferior izquierda para que
    // el texto se apoye SOBRE la línea inferior (como una firma escrita).
    // Preservamos el resto del estilo (font, color, bold, etc.).
    for (const m of mappings) {
      // Imagen tiene prioridad sobre texto: si la celda mapeada tiene una
      // imagen asignada (firma/foto), se ancla la imagen ahí y la celda
      // queda sin texto. Sin este check el valor `gridfs:xxx` caía como
      // texto en la celda de la firma.
      const img = imagesByCoord?.get(m.coord);
      if (img) {
        try {
          const imgId = wb.addImage({
            buffer: img.buffer as unknown as ArrayBuffer,
            extension: img.extension,
          });
          const cell = ws.getCell(m.coord);
          // ExcelJS trabaja con índices 0-based para tl/br (top-left/bottom-right).
          // La celda A1 tiene row=1, col=1 → tl { col: 0, row: 0 }.
          const rowIdx = Number(cell.row) - 1;
          const colIdx = Number(cell.col) - 1;

          // Detectar si la celda es parte de un merge y usar el rango
          // completo para anclar la imagen. Sin esto, la firma quedaba
          // con tamaño fijo 160×60 flotando en la esquina superior de
          // una línea larga. Con tl+br la imagen se estira al rango real
          // de la celda mergeada — la firma queda apoyada sobre la línea
          // como una firma manuscrita, ocupando su ancho natural.
          //
          // Fallback si no está mergeada: extiende ~5 columnas y 1 row a
          // la derecha, tamaño razonable para una firma inline.
          const merged = this.findMergeForCell(ws, m.coord);
          const endRowIdx = merged ? merged.endRow - 1 : rowIdx;
          const endColIdx = merged ? merged.endCol - 1 : colIdx + 5;

          // Padding pequeño para que la firma no se pegue a los bordes.
          // Usamos offsets fraccionarios (0.02 = 2% del ancho de celda).
          ws.addImage(imgId, {
            tl: { col: colIdx + 0.02, row: rowIdx + 0.05 },
            br: { col: endColIdx + 0.98, row: endRowIdx + 0.95 },
            editAs: 'oneCell',
          } as unknown as ExcelJS.ImageRange);
          // Blanqueamos el texto para que no aparezca el gridfs:xxx debajo.
          cell.value = null;
        } catch (err) {
          this.logger.warn(
            `[fillXlsx] No se pudo insertar imagen en ${m.coord}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
        continue;
      }

      const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
      const val = values[key];
      if (val === undefined) continue;
      const cell = ws.getCell(m.coord);
      cell.value = val;
      // wrapText solo si la celda está en un merge ancho: en celdas de una
      // sola columna wrapText parte el valor por caracteres (ej: un documento
      // de identidad "11111111111" se veía cortado a "11" porque el resto
      // fluía a las siguientes celdas invisibles). Sin merge, dejamos el
      // valor sin wrap para que se muestre completo.
      const isMerged = !!this.findMergeForCell(ws, m.coord);
      cell.alignment = {
        ...(cell.alignment ?? {}),
        horizontal: 'left',
        vertical: 'bottom',
        indent: 1,
        wrapText: isMerged,
      };
    }

    // Reemplazar la primera imagen embebida por el logo custom, si hay.
    // Los "media" del workbook son las imágenes brutas — anchor+size están
    // por hoja en `ws.getImages()`. Reemplazar el buffer de la media
    // preserva la posición/tamaño originales.
    if (customLogoBase64) {
      const parsed = this.parseDataUri(customLogoBase64);
      if (parsed) {
        const media = (wb.model as unknown as { media?: Array<{ buffer?: Buffer; extension?: string }> })
          .media;
        if (media && media.length > 0) {
          media[0].buffer = parsed.buffer;
          media[0].extension = parsed.extension;
        } else {
          // No había imagen — agregamos una en A1 con tamaño razonable.
          const imgId = wb.addImage({
            buffer: parsed.buffer as unknown as ArrayBuffer,
            extension: parsed.extension as 'png' | 'jpeg' | 'gif',
          });
          ws.addImage(imgId, {
            tl: { col: 0, row: 0 },
            ext: { width: 160, height: 60 },
          });
        }
      }
    }

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  /** Convierte un XLSX buffer a HTML anotado (mismo pipeline que preview). */
  async convertBufferToHtml(buffer: Buffer): Promise<{ html: string; css: string }> {
    return this.convertXlsxToAnnotatedHtml(buffer);
  }

  /** Convierte un XLSX buffer a PDF con LibreOffice. */
  async convertBufferToPdf(buffer: Buffer): Promise<Buffer> {
    if (!fs.existsSync(this.sofficePath)) {
      throw new InternalServerErrorException(
        `LibreOffice no está instalado o no se encuentra en ${this.sofficePath}.`,
      );
    }
    const jobId = randomBytes(8).toString('hex');
    const workDir = path.join(os.tmpdir(), `soulforms-xlsx-pdf-${jobId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inputPath = path.join(workDir, 'input.xlsx');
    const outputPath = path.join(workDir, 'input.pdf');
    const userProfileArg = `-env:UserInstallation=file:///${workDir.replace(/\\/g, '/')}/profile`;

    try {
      fs.writeFileSync(inputPath, buffer);
      await execFileP(
        this.sofficePath,
        [
          userProfileArg,
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          workDir,
          inputPath,
        ],
        { timeout: 120_000 },
      );
      if (!fs.existsSync(outputPath)) {
        throw new InternalServerErrorException(
          'LibreOffice no generó el PDF esperado.',
        );
      }
      return fs.readFileSync(outputPath);
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  }

  /** Parsea un data URI "data:image/png;base64,AAA..." a buffer + ext. */
  private parseDataUri(
    dataUri: string,
  ): { buffer: Buffer; extension: string } | null {
    const m = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i.exec(dataUri);
    if (!m) return null;
    let ext = m[1].toLowerCase();
    // Normalizamos extensiones que exceljs admite: 'png' | 'jpeg' | 'gif'.
    if (ext === 'jpg') ext = 'jpeg';
    if (ext === 'svg+xml') ext = 'png'; // svg lo tratamos como png en el fallback
    return { buffer: Buffer.from(m[2], 'base64'), extension: ext };
  }
}
