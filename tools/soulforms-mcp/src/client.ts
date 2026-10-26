/**
 * Cliente HTTP para la API de SoulForms.
 *
 * Autenticación: API Key en header `x-api-key`. Las keys se emiten desde el
 * panel admin de SoulForms (`/admin?section=api_keys`) y solo pueden crearlas
 * usuarios con rol admin. El backend resuelve la key al owner y pobla
 * `req.user` con sus datos, así los permisos (ej. FORMS_CREATE) se evalúan
 * contra ese usuario — no es un bypass.
 *
 * Las keys no caducan (son revocables manualmente), por lo que no hay flujo
 * de refresh: una vez configurada en el env del MCP, funciona hasta que un
 * admin la revoque.
 */

export interface SoulFormsConfig {
  apiUrl: string;
  apiKey: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
  ownerId: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
  projectId: string;
}

export interface Form {
  id: string;
  name: string;
  folderId: string;
  schema: { widgets: WidgetInstance[]; rules?: unknown[] };
  version: number;
  isActive: boolean;
  createdById: number;
}

export interface WidgetInstance {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
}

export class SoulFormsClient {
  constructor(private readonly cfg: SoulFormsConfig) {
    if (!cfg.apiUrl) throw new Error("SOULFORMS_API_URL is required");
    if (!cfg.apiKey) {
      throw new Error(
        "SOULFORMS_API_KEY is required. Generate one at /admin?section=api_keys",
      );
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.cfg.apiUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.cfg.apiKey,
      ...(init?.headers as Record<string, string> | undefined),
    };
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // 401/403 casi siempre significa que la key fue revocada o el user owner
      // perdió el permiso FORMS_CREATE. Mensaje explícito para que el agente
      // pueda informar al humano sin diagnosticar.
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `${init?.method ?? "GET"} ${path} → ${res.status}. Revisa que la API key siga activa y que el usuario owner tenga el permiso correspondiente.`,
        );
      }
      throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status} ${text}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects");
  }

  // ── Folders ───────────────────────────────────────────────────────────────
  listFolders(projectId: string): Promise<Folder[]> {
    return this.request<Folder[]>(
      `/folders?projectId=${encodeURIComponent(projectId)}`,
    );
  }

  createFolder(input: {
    name: string;
    projectId: string;
    color?: string;
    icon?: string;
  }): Promise<Folder> {
    return this.request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ── Forms ─────────────────────────────────────────────────────────────────
  listFormsInFolder(folderId: string): Promise<Form[]> {
    return this.request<Form[]>(
      `/forms?folderId=${encodeURIComponent(folderId)}`,
    );
  }

  getForm(id: string): Promise<Form> {
    return this.request<Form>(`/forms/${encodeURIComponent(id)}`);
  }

  createForm(input: {
    name: string;
    folderId: string;
    widgets: WidgetInstance[];
  }): Promise<Form> {
    return this.request<Form>("/forms", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        folderId: input.folderId,
        schema: { widgets: input.widgets, rules: [] },
      }),
    });
  }
}
