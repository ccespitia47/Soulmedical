import type { SearchWidgetConfig } from "../search.types";

type Row = Record<string, unknown>;

/** Parser CSV básico que respeta comillas (campos con comas/saltos de línea
 * embebidos y comillas escapadas ""). El split naive anterior rompía con
 * cualquier valor de Google Sheets que contuviera una coma. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export async function searchGoogleSheets(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.sheetsUrl || !q.trim()) return [];
  // Convierte URL de Google Sheets a URL de exportación CSV
  const match = config.sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return [];
  const sheetId = match[1];
  const range = config.sheetsRange || "A:Z";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&range=${encodeURIComponent(range)}`;
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCsv(text).map((r) => r.map((c) => c.trim()));
  const headers = rows[0] ?? [];
  const searchCol = config.sheetsSearchCol ?? "";
  // findIndex devuelve -1 (no undefined) cuando no encuentra match, así que
  // `?? 0` nunca aplicaba — usamos Math.max(0, ...) para caer a la primera
  // columna solo cuando realmente no hay match.
  const colIdx = Math.max(0, headers.findIndex((h) => h.toLowerCase() === searchCol.toLowerCase()));
  return rows.slice(1)
    .filter((r) => r[colIdx]?.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
