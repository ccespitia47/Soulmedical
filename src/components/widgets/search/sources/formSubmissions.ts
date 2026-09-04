import type { SearchWidgetConfig } from "../search.types";
import { API_URL } from "./apiUrl";

type Row = Record<string, unknown>;

/** Contexto de enlace compartible: token de la tarea + id del widget. */
type ShareLookup = { token: string; widgetId: string };

export async function searchFormSubmissions(
  config: SearchWidgetConfig,
  q: string,
  share?: ShareLookup,
): Promise<Row[]> {
  // Nota: ANTES bloqueábamos q vacío con `if (!q.trim()) return [];`.
  // Ahora q vacío es válido — devuelve los primeros N sin filtrar
  // (preview inicial del modal).

  // Página pública del enlace compartible: no hay sesión, así que usamos el
  // endpoint público ligado al token de la tarea (el backend resuelve el
  // widget por id y solo busca en el sourceFormId configurado).
  if (share) {
    const res = await fetch(`${API_URL}/api/tasks/share/${share.token}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetId: share.widgetId, q }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? data.data ?? [];
  }

  // Flujo autenticado normal.
  if (!config.sourceFormId) return [];
  const params = new URLSearchParams({
    q,
    fields: (config.searchableFields ?? []).join(","),
    limit: q.trim() ? "20" : "50",
  });
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${API_URL}/api/forms/${config.sourceFormId}/submissions/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data.data ?? [];
}
