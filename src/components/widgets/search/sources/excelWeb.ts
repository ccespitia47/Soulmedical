import type { SearchWidgetConfig } from "../search.types";

type Row = Record<string, unknown>;

export async function searchExcelWeb(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.excelUrl || !q.trim()) return [];
  const { read, utils } = await import("xlsx");
  const res = await fetch(config.excelUrl);
  const ab = await res.arrayBuffer();
  const wb = read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Row[] = utils.sheet_to_json(ws);
  const col = config.excelSearchCol ?? "";
  return rows
    .filter((r) => String(r[col] ?? "").toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20);
}
