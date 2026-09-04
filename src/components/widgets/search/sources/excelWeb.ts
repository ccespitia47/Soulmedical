import type { SearchWidgetConfig } from "../search.types";

type Row = Record<string, unknown>;

const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Devuelve los headers (primera fila) del Excel. Delegado al backend
 * proxy — el navegador no puede leer OneDrive/SharePoint directo por CORS.
 */
export async function fetchExcelHeaders(url: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/excel/headers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.headers) ? data.headers : [];
}

/**
 * Busca en el Excel apuntado por config.excelUrl.
 * Todo el trabajo (auth Graph, download, parse) se hace en el backend.
 */
export async function searchExcelWeb(
  config: SearchWidgetConfig,
  q: string,
): Promise<Row[]> {
  // Con q vacío devolvemos vacío por ahora — el backend /excel/search
  // no soporta preview sin query y agregarlo requiere modificar el flujo
  // Graph API. Deferido; el modal mostrará "sin resultados" hasta que el
  // usuario escriba (mismo UX que hoy para este source específico).
  if (!config.excelUrl || !q.trim() || !config.excelSearchCol) return [];
  const res = await fetch(`${API_URL}/excel/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      url: config.excelUrl,
      q,
      searchCol: config.excelSearchCol,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.rows) ? data.rows : [];
}
