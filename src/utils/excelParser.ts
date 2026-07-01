import * as XLSX from "xlsx";
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

export type EmbeddedImage = {
  b64: string;
  col: number;
  row: number;
};

export const COL_WIDTHS: Record<string, number> = {
  A: 100, B: 150, C: 110, D: 115, E: 110,
  F: 135, G: 170, H: 180, I: 185,
};

export const COL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

export const MAPPABLE_ROWS = new Set([4, ...Array.from({ length: 18 }, (_, i) => i + 6)]);

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return [
    d.getUTCDate().toString().padStart(2, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("-");
}

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
          /<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g
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

export function parseExcel(base64: string): CellData[][] {
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

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
  const rows: CellData[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowArr: CellData[] = [];
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
      const isCenter =
        (rowNum === 1 && colLetter === "C") ||
        (rowNum === 5 && ["A", "G"].includes(colLetter)) ||
        (rowNum >= 24 && ["A", "B", "C", "G"].includes(colLetter));

      rowArr.push({
        coord,
        col: colLetter,
        row: rowNum,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        isMappable: MAPPABLE_ROWS.has(rowNum),
        style: { align: isCenter ? "center" : "left", bold: isBold, wrapText: true },
      });
    }
    rows.push(rowArr);
  }
  return rows;
}

export function decodeCol(letter: string): number {
  return XLSX.utils.decode_col(letter);
}
