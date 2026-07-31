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

/** Extrae el ID del spreadsheet y el gid de la hoja específica desde una
 *  URL pública de Google Sheets. Devuelve null si la URL no es válida. */
export function parseSheetsUrl(url: string): { id: string; gid: string | null } | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch?.[1] ?? null };
}

/** Construye la URL de exportación CSV para una hoja específica. Si no hay
 *  gid, exporta la hoja default del spreadsheet. */
function buildCsvUrl(id: string, gid: string | null, range?: string): string {
  const params = new URLSearchParams({ tqx: "out:csv" });
  if (gid) params.set("gid", gid);
  if (range) params.set("range", range);
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${params.toString()}`;
}

/** Descarga la primera fila (headers) de la hoja indicada. Útil para poblar
 *  dropdowns en el panel de configuración. */
export async function fetchSheetsHeaders(url: string): Promise<string[]> {
  const parsed = parseSheetsUrl(url);
  if (!parsed) return [];
  const csvUrl = buildCsvUrl(parsed.id, parsed.gid, "A1:Z1");
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCsv(text);
  return (rows[0] ?? []).map((c) => c.trim()).filter(Boolean);
}

export async function searchGoogleSheets(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.sheetsUrl || !q.trim()) return [];
  const parsed = parseSheetsUrl(config.sheetsUrl);
  if (!parsed) return [];
  // Prioridad: gid explícito de la config (nuevo), gid en la URL, o hoja default.
  const gid = config.sheetsGid ?? parsed.gid;
  const csvUrl = buildCsvUrl(parsed.id, gid, config.sheetsRange || undefined);
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
