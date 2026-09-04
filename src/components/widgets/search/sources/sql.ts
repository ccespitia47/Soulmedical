import type { SearchWidgetConfig } from "../search.types";

type Row = Record<string, unknown>;

export async function searchSQL(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  // Con q vacío devolvemos vacío por ahora — el endpoint SQL configurable
  // no tiene contrato definido para preview sin query. El usuario debe
  // escribir para obtener resultados (mismo UX que hoy para SQL).
  if (!config.sqlEndpoint || !q.trim()) return [];
  // Allowlist same-origin: sin esto, la config del widget (guardada por
  // cualquier usuario con acceso al builder) podía apuntar a un endpoint
  // arbitrario y el navegador de OTRO usuario le pegaría con su sesión
  // vigente — un vector de SSRF/exfiltración disfrazado de "fuente SQL".
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(config.sqlEndpoint, window.location.origin);
  } catch {
    console.warn("[SearchWidget] sqlEndpoint inválido:", config.sqlEndpoint);
    return [];
  }
  if (endpointUrl.origin !== window.location.origin) {
    console.warn("[SearchWidget] sqlEndpoint rechazado por same-origin policy:", config.sqlEndpoint);
    return [];
  }
  const token = localStorage.getItem("token") ?? "";
  const res = await fetch(`${config.sqlEndpoint}${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}
