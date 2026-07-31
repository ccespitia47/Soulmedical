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

/**
 * Extrae el ID del spreadsheet y el gid de la hoja específica desde una URL
 * pública de Google Sheets. Detecta dos formatos:
 *
 * - "Compartir con enlace"  → /spreadsheets/d/{ID}/edit
 * - "Publicar en la Web"    → /spreadsheets/d/e/{PUBLISHED_ID}/pubhtml
 *
 * Devuelve null si la URL no coincide con ningún formato conocido.
 */
export function parseSheetsUrl(
  url: string,
): { id: string; gid: string | null; published: boolean } | null {
  // Publicado tiene prioridad porque su regex es más específico.
  const publishedMatch = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) {
    const gidMatch = url.match(/[?#&]gid=(\d+)/);
    return { id: publishedMatch[1], gid: gidMatch?.[1] ?? null, published: true };
  }
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch?.[1] ?? null, published: false };
}

/**
 * Construye la URL de exportación CSV según el tipo de URL detectada.
 *
 * - Compartir con enlace: /spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&gid=...
 * - Publicar en la Web:   /spreadsheets/d/e/{ID}/pub?output=csv&gid=...
 *
 * Si no hay gid, exporta la hoja default del spreadsheet.
 */
function buildCsvUrl(
  id: string,
  gid: string | null,
  published: boolean,
  range?: string,
): string {
  if (published) {
    const params = new URLSearchParams({ output: "csv" });
    if (gid) params.set("gid", gid);
    if (range) params.set("range", range);
    return `https://docs.google.com/spreadsheets/d/e/${id}/pub?${params.toString()}`;
  }
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
  // El endpoint /pub?output=csv devuelve el sheet completo (no acepta 'range'),
  // así que descargamos y tomamos solo la primera fila. Para /gviz/tq sí
  // podemos limitar con range para reducir bytes.
  const csvUrl = buildCsvUrl(parsed.id, parsed.gid, parsed.published, parsed.published ? undefined : "A1:Z1");
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
  // El endpoint /pub?output=csv NO acepta el parámetro range — devuelve el
  // sheet completo; filtramos en memoria abajo.
  const range = parsed.published ? undefined : (config.sheetsRange || undefined);
  const csvUrl = buildCsvUrl(parsed.id, gid, parsed.published, range);
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
