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

/** Descarga la primera fila (headers) de la hoja indicada vía proxy backend.
 *
 * El fetch directo al endpoint /pub?output=csv de un Sheet "Publicado en
 * la Web" (URL /d/e/...) responde con 307 → googleusercontent.com, y el
 * navegador bloquea el redirect por CORS (googleusercontent no envía
 * Access-Control-Allow-Origin). Resultado: fetch devolvía [] silenciosamente
 * y los widgets quedaban sin `sheetColumns` → sin chips `${widget.col}`.
 *
 * El backend (POST /forms/search-source/sheets-headers) no tiene esa
 * restricción. Devuelve `{ headers, gid }`. Si el usuario pegó una URL con
 * #gid=…, el gid detectado se guarda vía el caller en `config.sheetsGid`.
 */
export async function fetchSheetsHeaders(url: string): Promise<string[]> {
  const parsed = parseSheetsUrl(url);
  if (!parsed) return [];
  const base = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${base}/forms/search-source/sheets-headers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    // El backend ya devuelve el motivo (401/403/400 con message). Loggeamos
    // para que el admin lo vea en consola; el caller muestra un mensaje
    // genérico en UI porque no todos los errores son recuperables desde ahí.
    try {
      const err = await res.json();
      console.warn("[fetchSheetsHeaders] backend:", res.status, err?.message);
    } catch {
      console.warn("[fetchSheetsHeaders] backend status:", res.status);
    }
    return [];
  }
  const data = (await res.json()) as { headers?: string[] };
  return Array.isArray(data?.headers) ? data.headers : [];
}

export async function searchGoogleSheets(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  // Nota: ANTES bloqueábamos q vacío. Ahora q vacío devuelve los primeros
  // 50 sin filtrar (preview inicial del modal).
  if (!config.sheetsUrl) return [];
  const parsed = parseSheetsUrl(config.sheetsUrl);
  if (!parsed) return [];
  const gid = config.sheetsGid ?? parsed.gid;
  const range = parsed.published ? undefined : (config.sheetsRange || undefined);
  const csvUrl = buildCsvUrl(parsed.id, gid, parsed.published, range);
  const res = await fetch(csvUrl);
  if (!res.ok) return [];
  const text = await res.text();
  const rows = parseCsv(text).map((r) => r.map((c) => c.trim()));
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  // Preview inicial: primeros 50 sin filtrar.
  if (!q.trim()) {
    return dataRows
      .slice(0, 50)
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  }

  // Búsqueda con query: filtro por columna configurada, primeros 20.
  const searchCol = config.sheetsSearchCol ?? "";
  const colIdx = Math.max(0, headers.findIndex((h) => h.toLowerCase() === searchCol.toLowerCase()));
  return dataRows
    .filter((r) => r[colIdx]?.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
