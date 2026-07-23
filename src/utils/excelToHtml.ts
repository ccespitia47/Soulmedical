import * as XLSX from "xlsx";
import type { ExcelFieldMapping } from "../types/email-template.types";

type CellStyle = {
  font?: { bold?: boolean; sz?: number };
  fgColor?: { rgb?: string };
  alignment?: { horizontal?: string; vertical?: string };
};

export function generateExcelHtml(
  excelBase64: string,
  mappings: ExcelFieldMapping[],
  formValues: Record<string, string>,
  logoBase64?: string
): string | null {
  try {
    const raw = excelBase64.includes(",") ? excelBase64.split(",")[1] : excelBase64;
    const wb = XLSX.read(raw, { type: "base64" });
    const ws = wb.Sheets[wb.SheetNames[0]];

    const mergedSkip = new Set<string>();
    const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
    for (const m of (ws["!merges"] as XLSX.Range[]) || []) {
      const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      mergedMap[tl] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
      for (let r = m.s.r; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++) {
          const coord = XLSX.utils.encode_cell({ r, c });
          if (coord !== tl) mergedSkip.add(coord);
        }
    }

    const valueMap: Record<string, string> = {};
    for (const m of mappings) {
      const key = m.placeholder.replace(/^\$\{/, "").replace(/\}$/, "");
      valueMap[m.coord] = formValues[key] ?? "";
    }

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
    const totalCols = range.e.c - range.s.c + 1;
    const isLandscape = totalCols > 7;

    const wsCols = (ws["!cols"] as Array<{ wch?: number; wpx?: number }> | undefined) ?? [];
    const colWidthsPx: number[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const colInfo = wsCols[c];
      const px = colInfo?.wpx ?? (colInfo?.wch ? Math.round(colInfo.wch * 7) : 80);
      colWidthsPx.push(Math.max(px, 40));
    }

    const wsRows = (ws["!rows"] as Array<{ hpt?: number; hpx?: number }> | undefined) ?? [];
    const rowHeightsPx: number[] = [];
    let naturalTotalH = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowInfo = wsRows[r];
      const px = rowInfo?.hpx ?? (rowInfo?.hpt ? Math.round(rowInfo.hpt * 1.33) : 18);
      const h = Math.max(px, 14);
      rowHeightsPx.push(h);
      naturalTotalH += h;
    }

    const pageHeightPx = isLandscape ? 744 : 1056;
    const availableH = pageHeightPx - 46;
    const scaleFactor = naturalTotalH < availableH ? availableH / naturalTotalH : 1;
    const finalRowHeights = rowHeightsPx.map((h) => Math.floor(h * scaleFactor));

    let tableRows = "";
    for (let r = range.s.r; r <= range.e.r; r++) {
      const rowH = finalRowHeights[r - range.s.r];
      tableRows += `<tr style="height:${rowH}px">`;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const coord = XLSX.utils.encode_cell({ r, c });
        if (mergedSkip.has(coord)) continue;
        const cell = ws[coord];
        const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };
        const cellStyle = cell?.s as CellStyle | undefined;
        const bgColor = cellStyle?.fgColor?.rgb ? `#${cellStyle.fgColor.rgb}` : null;
        const bold = cellStyle?.font?.bold ?? false;
        const fontSize = cellStyle?.font?.sz
          ? `${Math.round(cellStyle.font.sz * 1.1)}px`
          : "10px";
        const align = cellStyle?.alignment?.horizontal ?? "left";
        const valign = cellStyle?.alignment?.vertical ?? "middle";
        const rowNum = r + 1;
        const isHeader = rowNum <= 3;
        const isFooter = rowNum >= range.e.r - 2;
        const defaultBg = isHeader || isFooter ? "#e6f4f1" : "#ffffff";
        const finalBg = bgColor ?? defaultBg;

        let value = "";
        if (valueMap[coord] !== undefined) {
          const raw = valueMap[coord];
          // Firmas y demás campos que devuelven data URL de imagen se
          // renderizan como <img> en lugar de imprimir el base64 como texto.
          if (typeof raw === "string" && raw.startsWith("data:image/")) {
            value = `<img src="${raw}" style="max-height:80px;max-width:100%;object-fit:contain;display:block;margin:0 auto;">`;
          } else {
            value = String(raw ?? "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
          }
        } else if (cell?.v !== undefined && cell.v !== null) {
          value = String(cell.v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }

        const cellContent =
          logoBase64 && r === range.s.r && c === range.s.c
            ? `<img src="${logoBase64}" style="max-height:40px;max-width:100%;object-fit:contain;display:block">`
            : value;

        tableRows += `<td colspan="${merge.colspan}" rowspan="${merge.rowspan}" style="border:1px solid #9ca3af;padding:2px 5px;background:${finalBg};font-weight:${
          bold || isHeader ? "bold" : "normal"
        };font-size:${fontSize};text-align:${align};vertical-align:${valign};word-break:break-word;overflow:hidden">${cellContent}</td>`;
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
    html, body { width: 100%; font-family: Arial, sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
