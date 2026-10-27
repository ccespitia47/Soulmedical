import type { EmailRecipient } from "../types/email-template.types";
import { parseCsv, parseSheetsUrl } from "../components/widgets/search/sources/googleSheets";

/**
 * Resuelve en el navegador los destinatarios de email tipo "lookup". Para
 * cada recipient de tipo `lookup`, hace fetch del Google Sheet indicado,
 * busca la fila donde `row[matchColumn]` es igual al valor del widget que
 * da el match (case/accent-insensitive), y toma `row[emailColumn]` como
 * email resuelto. Resultado: mapa `{recipient.id: email}` que el backend
 * usa para armar los destinatarios finales.
 *
 * El backend no puede hacer este fetch porque no habla con Google Sheets;
 * la mecánica queda en el cliente (igual que el widget search).
 *
 * Los sheets se cachean por URL dentro de la invocación para evitar
 * fetches duplicados cuando varias columnas apuntan al mismo Sheet.
 */
export async function resolveLookupRecipients(
  template: {
    toRecipients?: EmailRecipient[];
    ccRecipients?: EmailRecipient[];
    bccRecipients?: EmailRecipient[];
  } | null | undefined,
  formData: Record<string, unknown>,
): Promise<Record<string, string>> {
  if (!template) return {};
  const all = [
    ...(template.toRecipients ?? []),
    ...(template.ccRecipients ?? []),
    ...(template.bccRecipients ?? []),
  ].filter((r): r is Extract<EmailRecipient, { type: "lookup" }> | EmailRecipient =>
    r.type === "lookup",
  );
  if (all.length === 0) return {};

  const sheetCache = new Map<string, Record<string, string>[]>();
  const result: Record<string, string> = {};

  for (const r of all) {
    if (r.type !== "lookup") continue;
    const { sheetUrl, matchColumn, emailColumn, widgetId } = r;
    if (!sheetUrl || !matchColumn || !emailColumn || !widgetId) continue;

    const matchValueRaw = formData?.[widgetId];
    const matchValue =
      typeof matchValueRaw === "string" ? matchValueRaw.trim() : "";
    if (!matchValue) continue;

    let rows = sheetCache.get(sheetUrl);
    if (!rows) {
      try {
        rows = await fetchSheetRows(sheetUrl);
        sheetCache.set(sheetUrl, rows);
      } catch (e) {
        console.warn(`[lookupRecipients] No pude cargar ${sheetUrl}:`, e);
        continue;
      }
    }

    const normalized = normalize(matchValue);
    const found = rows.find((row) => normalize(row[matchColumn] ?? "") === normalized);
    if (!found) continue;

    const email = (found[emailColumn] ?? "").trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result[r.id] = email;
    }
  }

  return result;
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Carga TODAS las filas (como objetos keyed por header) de un Google Sheet
 * público. Reusa `parseSheetsUrl` y `parseCsv` del widget search.
 */
async function fetchSheetRows(url: string): Promise<Record<string, string>[]> {
  const parsed = parseSheetsUrl(url);
  if (!parsed) throw new Error("URL de Google Sheets no reconocida");
  const csvUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv${
    parsed.gid ? `&gid=${parsed.gid}` : ""
  }`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text).map((r) => r.map((c) => c.trim()));
  const headers = rows[0] ?? [];
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
