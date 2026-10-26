import ExcelJS from "exceljs";
import JSZip from "jszip";

export type CellStyle = {
  align: "left" | "center" | "right";
  bold: boolean;
  wrapText: boolean;
};

export type CellData = {
  coord: string;
  col: string;
  row: number;
  value: string;
  rowspan: number;
  colspan: number;
  isMappable: boolean;
  style: CellStyle;
};

export type ExcelColumn = {
  letter: string;
  width: number;
};

export type ExcelParsed = {
  columns: ExcelColumn[];
  rows: CellData[][];
  rowHeights: number[];
};

export type EmbeddedImage = {
  b64: string;
  col: number;
  row: number;
};

export async function extractImages(base64: string): Promise<EmbeddedImage[]> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const zip = await JSZip.loadAsync(raw, { base64: true });
    const drawingFiles = zip.file(/xl\/drawings\/drawing\d+\.xml$/);
    if (!drawingFiles.length) return [];

    const images: EmbeddedImage[] = [];

    for (const drawingFile of drawingFiles) {
      const xml = await drawingFile.async("string");
      const drawingName = drawingFile.name.split("/").pop()!;
      const relFile = zip.file(`xl/drawings/_rels/${drawingName}.rels`);
      if (!relFile) continue;

      const relXml = await relFile.async("string");
      const relMap: Record<string, string> = {};
      for (const m of relXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
        relMap[m[1]] = m[2];
      }

      const anchors = [
        ...xml.matchAll(
          /<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g,
        ),
      ];

      for (const anchor of anchors) {
        const c = anchor[1];
        const colM = c.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
        const rowM = c.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const rIdM = c.match(/r:embed="(rId\d+)"/);
        if (!colM || !rowM || !rIdM) continue;

        const target = relMap[rIdM[1]];
        if (!target) continue;
        const imgFile = zip.file(target.replace("../", "xl/"));
        if (!imgFile) continue;

        const imgB64 = await imgFile.async("base64");
        const ext = target.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        images.push({ b64: `data:${mime};base64,${imgB64}`, col: +colM[1], row: +rowM[1] });
      }
    }
    return images;
  } catch (e) {
    console.warn("No se pudieron extraer imágenes:", e);
    return [];
  }
}

// ─── Helpers de layout ────────────────────────────────────────────────────

function colLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel column width (chars) → px a Calibri 11 (≈7px por char). Mínimo 50. */
function colWidthToPx(w: number | undefined): number {
  if (typeof w !== "number") return 90;
  return Math.max(50, Math.round(w * 7));
}

function stringifyCellValue(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (v instanceof Date) {
    // Formato dd/mm/yyyy que Sara ya usa en los formatos.
    return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  }
  const anyV = v as { richText?: Array<{ text?: string }>; text?: string; result?: unknown };
  if (Array.isArray(anyV.richText)) {
    return anyV.richText.map((r) => r.text ?? "").join("");
  }
  if (typeof anyV.text === "string") return anyV.text;
  if (anyV.result !== undefined) return String(anyV.result);
  return String(v);
}

function decodeRange(s: string): {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
} | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(s);
  if (!m) return null;
  return {
    startCol: decodeCol(m[1].toUpperCase()),
    startRow: parseInt(m[2], 10),
    endCol: decodeCol(m[3].toUpperCase()),
    endRow: parseInt(m[4], 10),
  };
}

export function decodeCol(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// ─── parseExcel — nuevo, con exceljs y rango real ─────────────────────────

/**
 * Lee el Excel completo con estilos reales (fuentes, alineación, negritas)
 * usando exceljs. Detecta el rango REAL escrito — ignora `!ref` cuando está
 * inflado (algunos archivos guardan A1:Y995 aunque solo tengan L37 de
 * contenido, y sin este límite se ven miles de columnas vacías).
 *
 * Devuelve `{columns, rows}` — la UI usa `columns` para armar el <colgroup>
 * con anchos y letras reales del Excel, sin depender de constantes hardcoded.
 */
export async function parseExcel(base64: string): Promise<ExcelParsed> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { columns: [], rows: [], rowHeights: [] };

  const maxRow = Math.max(ws.actualRowCount, 1);
  const maxCol = Math.max(ws.actualColumnCount, 1);

  // ─── Merges ────────────────────────────────────────────────────────────
  const mergedSkip = new Set<string>();
  const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
  const mergeStrings: string[] = (ws.model?.merges as string[]) ?? [];
  for (const s of mergeStrings) {
    const r = decodeRange(s);
    if (!r) continue;
    const tl = `${colLetter(r.startCol)}${r.startRow}`;
    mergedMap[tl] = {
      rowspan: r.endRow - r.startRow + 1,
      colspan: r.endCol - r.startCol + 1,
    };
    for (let rr = r.startRow; rr <= r.endRow; rr++) {
      for (let cc = r.startCol; cc <= r.endCol; cc++) {
        const coord = `${colLetter(cc)}${rr}`;
        if (coord !== tl) mergedSkip.add(coord);
      }
    }
  }

  // ─── Anchos reales por columna ────────────────────────────────────────
  const columns: ExcelColumn[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = ws.getColumn(c);
    columns.push({ letter: colLetter(c), width: colWidthToPx(col.width) });
  }

  // ─── Alturas reales por fila (Excel puntos → pixels ×1.33) ─────────────
  // Sin esto, todas las filas se ven a la altura mínima 20px, lo que
  // aplasta el formato vs. el original (headers de 30px, filas de contenido
  // de 15-25px).
  const rowHeights: number[] = [];
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const px = row.height ? Math.round(row.height * 1.33) : 22;
    rowHeights.push(Math.max(18, px));
  }

  // ─── Celdas ─────────────────────────────────────────────────────────────
  const rows: CellData[][] = [];
  for (let r = 1; r <= maxRow; r++) {
    const rowArr: CellData[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const coord = `${colLetter(c)}${r}`;
      if (mergedSkip.has(coord)) continue;

      const cell = ws.getCell(r, c);
      const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };
      const font = cell.font ?? {};
      const alignment = cell.alignment ?? {};

      const value =
        cell.value !== null && cell.value !== undefined
          ? stringifyCellValue(cell.value)
          : "";

      // Alignment: mapeamos horizontales de Excel → 3 opciones CSS.
      const hAlign = alignment.horizontal;
      const align: "left" | "center" | "right" =
        hAlign === "center" || hAlign === "centerContinuous"
          ? "center"
          : hAlign === "right"
            ? "right"
            : "left";

      // Regla de mappeable — la celda es mapeable cuando NO trae texto propio
      // (es un campo del formato para rellenar). Antes esto estaba hardcoded
      // a `MAPPABLE_ROWS = [4, 6..23]` que solo servía para un formato específico.
      const isMappable = value.trim() === "";

      rowArr.push({
        coord,
        col: colLetter(c),
        row: r,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        isMappable,
        style: {
          align,
          bold: !!font.bold,
          wrapText: alignment.wrapText !== false,
        },
      });
    }
    rows.push(rowArr);
  }

  return { columns, rows, rowHeights };
}
