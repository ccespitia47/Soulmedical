import type { SearchWidgetConfig } from "../search.types";
import { API_URL } from "./apiUrl";

type Row = Record<string, unknown>;

export async function searchFormSubmissions(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.sourceFormId || !q.trim()) return [];
  const params = new URLSearchParams({ q, fields: (config.searchableFields ?? []).join(","), limit: "20" });
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${API_URL}/api/forms/${config.sourceFormId}/submissions/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data.data ?? [];
}
