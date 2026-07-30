import type { SearchWidgetConfig } from "../search.types";
import { API_URL } from "./apiUrl";

type Row = Record<string, unknown>;

export async function searchGroup(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  if (!config.groupId || !q.trim()) return [];
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${API_URL}/api/groups/${config.groupId}/members/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}
