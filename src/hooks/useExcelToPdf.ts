import { useCallback } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ExcelFieldMapping as ExcelMapping } from "../types/email-template.types";

export type { ExcelFieldMapping as ExcelMapping } from "../types/email-template.types";

type GeneratePDFOptions = {
  excelBase64: string;
  mappings: ExcelMapping[];
  formValues: Record<string, string>; // placeholder → valor real
  customLogoBase64?: string;
  filename?: string;
};

// ─── Helpers (duplicados mínimos del ExcelPreview para ser autónomo) ──────────

const CENTER_CELLS = new Set([
  "C1", "A5", "G5",
  "A24", "B24", "C24", "G24",
  "A25", "B25", "C25",
  "E26", "G26", "I26", "G27",
]);

const CHAR_TO_PX = 7;
const ROW_PX = 18;

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return [
    d.getUTCDate().toString().padStart(2, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("-");
}

type CellInfo = {
  coord: string;
  value: string;
  rowspan: number;
  colspan: number;
  row: number;
  bold: boolean;
  align: string;
  fontSize: number;
};

function parseExcelCells(base64: string): {
  rows: CellInfo[][];
  colWidths: Record<string, number>;
  rowHeights: Record<number, number>;
} {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const wb = XLSX.read(raw, { type: "base64" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
  const mergedSkip = new Set<string>();
  for (const m of ((ws["!merges"] as XLSX.Range[]) || [])) {
    const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    mergedMap[tl] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) {
        const coord = XLSX.utils.encode_cell({ r, c });
        if (coord !== tl) mergedSkip.add(coord);
      }
  }

  type ColDim = { width?: number };
  type RowDim = { height?: number };

  const colsInfo = (ws["!cols"] as ColDim[] | undefined) || [];
  const rowsInfo = (ws["!rows"] as RowDim[] | undefined) || [];
  const defaultCols: Record<string, number> = {
    A: 100, B: 150, C: 110, D: 115, E: 110,
    F: 135, G: 170, H: 180, I: 185,
  };

  const colWidths: Record<string, number> = {};
  const rowHeights: Record<number, number> = {};

  ["A", "B", "C", "D", "E", "F", "G", "H", "I"].forEach((col, i) => {
    const w = colsInfo[i]?.width;
    colWidths[col] = w ? Math.round(w * CHAR_TO_PX) : defaultCols[col];
  });
  for (let i = 0; i < 27; i++) {
    const h = rowsInfo[i]?.height;
    rowHeights[i + 1] = h ? Math.round(h * 1.33) : ROW_PX;
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
  const rows: CellInfo[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowArr: CellInfo[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const coord = XLSX.utils.encode_cell({ r, c });
      if (mergedSkip.has(coord)) continue;
      const cell = ws[coord];
      const rowNum = r + 1;
      const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };

      let value = "";
      if (cell?.v !== undefined && cell.v !== null) {
        if (typeof cell.v === "number" && cell.v > 40000 && cell.v < 60000 && cell.t === "n")
          value = excelSerialToDate(cell.v);
        else
          value = String(cell.v);
      }

      rowArr.push({
        coord,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        row: rowNum,
        bold: rowNum <= 5 || rowNum >= 24,
        align: CENTER_CELLS.has(coord) ? "center" : "left",
        fontSize: rowNum === 1 ? 11 : 10,
      });
    }
    rows.push(rowArr);
  }

  return { rows, colWidths, rowHeights };
}

// ─── Construir HTML de la tabla (para html2canvas) ────────────────────────────

function buildTableHTML(
  rows: CellInfo[][],
  colWidths: Record<string, number>,
  rowHeights: Record<number, number>,
  mappings: ExcelMapping[],
  formValues: Record<string, string>,
  customLogoBase64?: string
): string {
  const mappingByCoord: Record<string, ExcelMapping> = {};
  for (const m of mappings) mappingByCoord[m.coord] = m;

  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const colgroup = cols.map((c) => `<col style="width:${colWidths[c] || 100}px">`).join("");

  const tbodyRows = rows.map((row) => {
    const height = rowHeights[row[0]?.row] || ROW_PX;
    const cells = row.map((cell) => {
      const mapping = mappingByCoord[cell.coord];
      let displayValue = cell.value;
      if (mapping && formValues[mapping.placeholder] !== undefined) {
        displayValue = formValues[mapping.placeholder];
      }

      const isLogoCell = cell.coord === "A1" && customLogoBase64;
      const content = isLogoCell
        ? `<img src="${customLogoBase64}" style="max-height:50px;max-width:100%;object-fit:contain;display:block;margin:0 auto;" />`
        : escapeHtml(displayValue);

      return `<td
        colspan="${cell.colspan}"
        rowspan="${cell.rowspan}"
        style="
          border:1px solid #9ca3af;
          padding:2px 4px;
          background:#ffffff;
          color:#000000;
          font-weight:${cell.bold ? 700 : 400};
          font-size:${cell.fontSize}px;
          text-align:${cell.align};
          vertical-align:middle;
          word-break:break-word;
          line-height:1.3;
          font-family:Arial,sans-serif;
        "
      >${content}</td>`;
    }).join("");

    return `<tr style="height:${height}px">${cells}</tr>`;
  }).join("");

  return `
    <div style="background:#ffffff;padding:12px;display:inline-block;">
      <table style="border-collapse:collapse;table-layout:fixed;font-family:Arial,sans-serif;font-size:10px;">
        <colgroup>${colgroup}</colgroup>
        <tbody>${tbodyRows}</tbody>
      </table>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useExcelToPdf() {
  /**
   * Genera el PDF y lo devuelve como base64 (para adjuntar al correo)
   * o lo descarga directamente si download=true
   */
  const generatePDF = useCallback(async (
    options: GeneratePDFOptions,
    download = false
  ): Promise<string> => {
    const { excelBase64, mappings, formValues, customLogoBase64, filename = "formulario.pdf" } = options;

    // Parsear el Excel
    const { rows, colWidths, rowHeights } = parseExcelCells(excelBase64);

    // Construir HTML
    const html = buildTableHTML(rows, colWidths, rowHeights, mappings, formValues, customLogoBase64);

    // Insertar en un div temporal oculto fuera del viewport
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      background: white;
      z-index: -1;
    `;
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;

      const isLandscape = imgW > imgH;
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "px",
        format: "a4",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const scale = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);

      pdf.addImage(imgData, "PNG", margin, margin, imgW * scale, imgH * scale);

      if (download) {
        pdf.save(filename);
      }

      // Retornar base64 para adjuntar al correo (sin el prefijo data:...)
      return pdf.output("datauristring");
    } finally {
      document.body.removeChild(container);
    }
  }, []);

  return { generatePDF };
}