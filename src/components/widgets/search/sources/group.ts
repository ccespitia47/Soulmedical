import type { SearchWidgetConfig } from "../search.types";
import { API_URL } from "./apiUrl";

type Row = Record<string, unknown>;

export async function searchGroup(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.groupId) return [];
  const token = localStorage.getItem("token") ?? "";
  // Con q vacío pedimos primeros 50 miembros como preview inicial del modal;
  // con q pega el filtro real. El endpoint /members/search maneja q="" hoy
  // devolviendo todos los miembros del grupo — un grupo típico es pequeño
  // (< 100), así que el slice(0,50) client-side cubre el caso.
  const qParam = encodeURIComponent(q);
  const res = await fetch(`${API_URL}/api/groups/${config.groupId}/members/search?q=${qParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Row[];
  return q.trim() ? data : data.slice(0, 50);
}
