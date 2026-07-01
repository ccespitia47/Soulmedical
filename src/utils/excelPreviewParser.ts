import * as XLSX from "xlsx";

export type PreviewCellData = {
  coord: string;
  col: string;
  row: number;
  value: string;
  rowspan: number;
  colspan: number;
  isData: boolean;
  style: {
    align: "left" | "center" | "right";
    bold: boolean;
    fontSize: number;
    wrapText: boolean;
    bgColor?: string;
    color?: string;
  };
};

type ColDim = { width: number };
type RowDim = { height: number };

export const PREVIEW_COL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
export const PREVIEW_ROW_PX = 18;

const MAPPABLE_ROWS = new Set([4, ...Array.from({ length: 18 }, (_, i) => i + 6)]);

const CENTER_CELLS = new Set([
  "C1", "A5", "G5",
  "A24", "B24", "C24", "G24",
  "A25", "B25", "C25",
  "E26", "G26", "I26", "G27",
]);

const CHAR_TO_PX = 7;

const DEFAULT_COLS: Record<string, number> = {
  A: 100, B: 150, C: 110, D: 115, E: 110,
  F: 135, G: 170, H: 180, I: 185,
};

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return [
    d.getUTCDate().toString().padStart(2, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("-");
}

export function parseExcelForPreview(base64: string): {
  rows: PreviewCellData[][];
  colWidths: Record<string, number>;
  rowHeights: Record<number, number>;
} {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const wb = XLSX.read(raw, { type: "base64" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
  const mergedSkip = new Set<string>();
  for (const m of (ws["!merges"] as XLSX.Range[]) || []) {
    const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    mergedMap[tl] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) {
        const coord = XLSX.utils.encode_cell({ r, c });
        if (coord !== tl) mergedSkip.add(coord);
      }
  }

  const colWidths: Record<string, number> = {};
  const colsInfo = (ws["!cols"] as ColDim[] | undefined) || [];
  PREVIEW_COL_LETTERS.forEach((col, i) => {
    const w = colsInfo[i]?.width;
    colWidths[col] = w ? Math.round(w * CHAR_TO_PX) : DEFAULT_COLS[col];
  });

  const rowHeights: Record<number, number> = {};
  const rowsInfo = (ws["!rows"] as RowDim[] | undefined) || [];
  for (let i = 0; i < 27; i++) {
    const h = rowsInfo[i]?.height;
    rowHeights[i + 1] = h ? Math.round(h * 1.33) : PREVIEW_ROW_PX;
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
  const rows: PreviewCellData[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowArr: PreviewCellData[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const coord = XLSX.utils.encode_cell({ r, c });
      if (mergedSkip.has(coord)) continue;

      const cell = ws[coord];
      const colLetter = XLSX.utils.encode_col(c);
      const rowNum = r + 1;
      const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };

      let value = "";
      if (cell?.v !== undefined && cell.v !== null) {
        if (typeof cell.v === "number" && cell.v > 40000 && cell.v < 60000 && cell.t === "n")
          value = excelSerialToDate(cell.v);
        else value = String(cell.v);
      }

      const isBold = rowNum <= 5 || rowNum >= 24;
      const isCenter = CENTER_CELLS.has(coord);

      rowArr.push({
        coord,
        col: colLetter,
        row: rowNum,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        isData: MAPPABLE_ROWS.has(rowNum),
        style: {
          align: isCenter ? "center" : "left",
          bold: isBold,
          fontSize: rowNum === 1 ? 11 : 10,
          wrapText: true,
          bgColor: rowNum <= 5 || rowNum >= 24 ? "#e6f4f1" : "#ffffff",
          color: "#000000",
        },
      });
    }
    rows.push(rowArr);
  }

  return { rows, colWidths, rowHeights };
}
