import ExcelJS from "exceljs";
import type { ExcelFieldMapping } from "../types/email-template.types";

// ─── Helpers de color ─────────────────────────────────────────────────────

const INDEXED_PALETTE: Record<number, string> = {
  // Paleta indexada de Excel — solo cubrimos las claves más comunes.
  // La 64 y 65 son "auto color" (foreground/background) que resolvemos
  // como negro visible / blanco visible respectivamente.
  64: "000000",
  65: "FFFFFF",
  0: "000000",
  1: "FFFFFF",
  2: "FF0000",
  3: "00FF00",
  4: "0000FF",
};

type ExcelColor =
  | { argb?: string; theme?: number; tint?: number; indexed?: number }
  | undefined;

function colorToHex(color: ExcelColor): string | null {
  if (!color) return null;
  if (color.argb && typeof color.argb === "string") {
    const c = color.argb.toUpperCase().replace(/^#/, "");
    // Excel a menudo escribe AARRGGBB; recortamos alpha si son 8 chars.
    const hex = c.length === 8 ? c.slice(2) : c;
    if (/^[0-9A-F]{6}$/.test(hex)) return `#${hex}`;
  }
  if (typeof color.indexed === "number" && INDEXED_PALETTE[color.indexed]) {
    return `#${INDEXED_PALETTE[color.indexed]}`;
  }
  if (typeof color.theme === "number") {
    // Simplificación: theme 0 = fondo (blanco), 1 = texto (casi negro).
    // Los demás themes usaríamos si el archivo trae theme1.xml parseado.
    if (color.theme === 0) return "#FFFFFF";
    if (color.theme === 1) return "#000000";
  }
  return null;
}

/** True si un color hex es negro puro — a veces Excel marca "sin color"
 * como negro en fills. Lo tratamos como "sin fondo" para no pintar todo. */
function isBlack(hex: string | null): boolean {
  if (!hex) return true;
  const c = hex.replace(/^#/, "").toUpperCase();
  return c === "000000";
}

function extractBgColor(fill: ExcelJS.Fill | undefined): string | null {
  if (!fill) return null;
  if (fill.type !== "pattern") return null;
  const pf = fill as ExcelJS.FillPattern;
  // "none" y "gray125" son marcadores de "sin fondo" en Excel; el
  // gray125 es literalmente un patrón de puntos usado como default.
  if (pf.pattern === "none" || pf.pattern === "gray125") return null;
  const candidate = pf.fgColor ?? pf.bgColor;
  const hex = colorToHex(candidate);
  return isBlack(hex) ? null : hex;
}

function borderSideCss(side: Partial<ExcelJS.Border> | undefined): string | undefined {
  if (!side?.style) return undefined;
  const color = colorToHex(side.color) ?? "#000000";
  const w =
    side.style === "thick" || side.style === "double"
      ? 2
      : side.style === "medium" || side.style === "mediumDashed"
        ? 1.5
        : 1;
  const type = side.style === "double" ? "double" : "solid";
  return `${w}px ${type} ${color}`;
}

/** Excel column width (chars) → pixels a Calibri 11 (≈7px por char). */
function colWidthToPx(w: number | undefined): number {
  if (typeof w !== "number") return 90;
  return Math.max(50, Math.round(w * 7));
}

// ─── Función principal ─────────────────────────────────────────────────────

export async function generateExcelHtml(
  excelBase64: string,
  mappings: ExcelFieldMapping[],
  formValues: Record<string, string>,
  logoBase64?: string,
): Promise<string | null> {
  try {
    const raw = excelBase64.includes(",") ? excelBase64.split(",")[1] : excelBase64;
    // atob → binary string → Uint8Array → ArrayBuffer (formato que exceljs consume).
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return null;

    // ─── Rango real usado (no las 995×25 fantasma del !ref inflado). ────
    // exceljs expone actualRowCount/actualColumnCount que respetan lo que
    // hay realmente escrito o con estilo, ignorando ranges heredados.
    const maxRow = Math.max(ws.actualRowCount, 1);
    const maxCol = Math.max(ws.actualColumnCount, 1);

    // ─── Merges ──────────────────────────────────────────────────────────
    // exceljs guarda merges como strings tipo "D1:J2". Los expandimos a
    // mergedSkip (celdas ocultas por estar dentro de un merge) y a
    // mergedMap (celda maestra → rowspan/colspan).
    const mergedSkip = new Set<string>();
    const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
    const mergeStrings: string[] = (ws.model?.merges as string[]) ?? [];
    for (const s of mergeStrings) {
      const range = ws.workbook.getWorksheet(ws.id)?.name
        ? decodeRange(s)
        : null;
      if (!range) continue;
      const tl = `${colLetter(range.startCol)}${range.startRow}`;
      mergedMap[tl] = {
        rowspan: range.endRow - range.startRow + 1,
        colspan: range.endCol - range.startCol + 1,
      };
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const coord = `${colLetter(c)}${r}`;
          if (coord !== tl) mergedSkip.add(coord);
        }
      }
    }

    // ─── Placeholders ────────────────────────────────────────────────────
    const valueMap: Record<string, string> = {};
    for (const m of mappings) {
      const key = m.placeholder.replace(/^\$\{/, "").replace(/\}$/, "");
      valueMap[m.coord] = formValues[key] ?? "";
    }

    // ─── Anchos de columna ───────────────────────────────────────────────
    const colWidthsPx: number[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const col = ws.getColumn(c);
      colWidthsPx.push(colWidthToPx(col.width));
    }
    const totalCols = maxCol;
    const isLandscape = totalCols > 7;

    // ─── Alturas de fila (puntos → pixels ×1.33) ─────────────────────────
    const rowHeightsPx: number[] = [];
    for (let r = 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const px = row.height ? Math.round(row.height * 1.33) : 20;
      rowHeightsPx.push(Math.max(14, px));
    }

    // ─── Render de celdas ────────────────────────────────────────────────
    let tableRows = "";
    for (let r = 1; r <= maxRow; r++) {
      tableRows += `<tr style="height:${rowHeightsPx[r - 1]}px">`;
      for (let c = 1; c <= maxCol; c++) {
        const coord = `${colLetter(c)}${r}`;
        if (mergedSkip.has(coord)) continue;

        const cell = ws.getCell(r, c);
        const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };

        const font = cell.font ?? {};
        const alignment = cell.alignment ?? {};
        const border = cell.border ?? {};
        const bgColor = extractBgColor(cell.fill);
        const fontColorRaw = colorToHex(font.color as ExcelColor);
        const fontName = font.name;
        const fontSize = typeof font.size === "number" ? `${font.size}px` : "11px";
        const bold = !!font.bold;
        const italic = !!font.italic;
        const align = alignment.horizontal ?? "left";
        const valign = alignment.vertical ?? "middle";
        const wrap = alignment.wrapText;

        // ─── Contenido de la celda ─────────────────────────────────────
        let value = "";
        if (valueMap[coord] !== undefined) {
          const rawVal = valueMap[coord];
          if (typeof rawVal === "string" && rawVal.startsWith("data:image/")) {
            value = `<img src="${rawVal}" style="max-height:80px;max-width:100%;object-fit:contain;display:block;margin:0 auto;">`;
          } else {
            value = escapeHtml(rawVal ?? "");
          }
        } else if (cell.value !== null && cell.value !== undefined) {
          // exceljs devuelve varios shapes según el tipo — normalizamos a
          // string plano (rich text → concatenamos runs; date → ISO; etc).
          value = escapeHtml(stringifyCellValue(cell.value));
        }

        const cellContent =
          logoBase64 && r === 1 && c === 1
            ? `<img src="${logoBase64}" style="max-height:40px;max-width:100%;object-fit:contain;display:block">`
            : value;

        // ─── Estilos inline ────────────────────────────────────────────
        const styleParts: string[] = [
          "padding:2px 5px",
          `font-size:${fontSize}`,
          `text-align:${align}`,
          `vertical-align:${valign}`,
          "overflow:hidden",
        ];
        if (fontName) styleParts.push(`font-family:'${fontName}', Calibri, Arial, sans-serif`);
        if (bold) styleParts.push("font-weight:bold");
        if (italic) styleParts.push("font-style:italic");
        if (fontColorRaw && !isBlack(fontColorRaw)) styleParts.push(`color:${fontColorRaw}`);
        else if (fontColorRaw) styleParts.push(`color:${fontColorRaw}`);
        if (bgColor) styleParts.push(`background:${bgColor}`);

        const bt = borderSideCss(border.top);
        const bb = borderSideCss(border.bottom);
        const bl = borderSideCss(border.left);
        const br = borderSideCss(border.right);
        if (bt) styleParts.push(`border-top:${bt}`);
        if (bb) styleParts.push(`border-bottom:${bb}`);
        if (bl) styleParts.push(`border-left:${bl}`);
        if (br) styleParts.push(`border-right:${br}`);

        if (wrap === false) {
          styleParts.push("white-space:nowrap");
        } else {
          styleParts.push("overflow-wrap:break-word");
          styleParts.push("white-space:pre-wrap");
        }

        tableRows += `<td colspan="${merge.colspan}" rowspan="${merge.rowspan}" style="${styleParts.join(";")}">${cellContent}</td>`;
      }
      tableRows += "</tr>";
    }

    const colgroup = colWidthsPx.map((w) => `<col style="width:${w}px">`).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; font-family: Calibri, 'Segoe UI', Arial, sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    @page { size: ${isLandscape ? "A4 landscape" : "A4 portrait"}; margin: 8mm; }
  </style>
</head>
<body>
  <table><colgroup>${colgroup}</colgroup><tbody>${tableRows}</tbody></table>
</body>
</html>`;
  } catch (e) {
    console.error("Error generando HTML del Excel:", e);
    return null;
  }
}

// ─── Utilidades internas ──────────────────────────────────────────────────

function colLetter(col: number): string {
  // 1 → "A", 27 → "AA", etc.
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
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
    startCol: colIndex(m[1].toUpperCase()),
    startRow: parseInt(m[2], 10),
    endCol: colIndex(m[3].toUpperCase()),
    endRow: parseInt(m[4], 10),
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stringifyCellValue(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Rich text: { richText: [{ text, font }, ...] } → concatenamos los runs.
  const anyV = v as { richText?: Array<{ text?: string }>; text?: string; result?: unknown };
  if (Array.isArray(anyV.richText)) {
    return anyV.richText.map((r) => r.text ?? "").join("");
  }
  // Hyperlink: { text, hyperlink } → mostramos el texto.
  if (typeof anyV.text === "string") return anyV.text;
  // Formula: { formula, result } → mostramos el resultado si lo calcularon.
  if (anyV.result !== undefined) return String(anyV.result);
  return String(v);
}
