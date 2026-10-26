/**
 * Cliente HTTP para la API de MoreApp.
 *
 * Base: https://api.moreapp.com/api/v1.0/customers/{customerId}/...
 * Auth: Bearer token (Service Account creado en el panel de MoreApp bajo
 * "Service Accounts" → el token se emite UNA sola vez).
 *
 * Si tu cuenta usa un endpoint o shape distinto al estándar documentado por
 * MoreApp, la primera llamada va a reflejar el error (status + body) y es
 * fácil ajustar aquí sin tocar el server.ts.
 */

export interface MoreAppConfig {
  apiUrl: string;      // ej. https://api.moreapp.com/api/v1.0
  token: string;       // Service Account token
  customerId: string;  // Customer id numérico asignado por MoreApp
}

export interface MoreAppFormSummary {
  id: string | number;
  name: string;
  folder?: { id: string | number; name: string } | null;
  // El payload real puede traer más campos (createdOn, etc.); los dejamos
  // pasar como `extra` para que la tool devuelva todo tal cual al agente.
  [k: string]: unknown;
}

export interface MoreAppField {
  uid?: string;
  name?: string;
  label?: string;
  type?: string;          // "text", "number", "email", "radio", "signature", ...
  required?: boolean;
  properties?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface MoreAppForm {
  id: string | number;
  name: string;
  fields?: MoreAppField[];
  // Algunos payloads devuelven `elements` o `pages[].fields` en vez de `fields`;
  // devolvemos el objeto completo para que Claude pueda inspeccionar la
  // estructura real sin depender de un parser rígido aquí.
  [k: string]: unknown;
}

export class MoreAppClient {
  constructor(private readonly cfg: MoreAppConfig) {
    if (!cfg.apiUrl) throw new Error("MOREAPP_API_URL is required");
    if (!cfg.token) throw new Error("MOREAPP_API_TOKEN is required");
    if (!cfg.customerId) throw new Error("MOREAPP_CUSTOMER_ID is required");
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.cfg.apiUrl.replace(/\/$/, "")}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.cfg.token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `MoreApp GET ${path} → ${res.status}. ${body.slice(0, 500)}`,
      );
    }
    return (await res.json()) as T;
  }

  /** Lista todos los formularios del customer. */
  listForms(): Promise<MoreAppFormSummary[]> {
    return this.request<MoreAppFormSummary[]>(
      `/customers/${encodeURIComponent(this.cfg.customerId)}/forms`,
    );
  }

  /** Devuelve el detalle completo de un formulario (incluye campos). */
  getForm(formId: string | number): Promise<MoreAppForm> {
    return this.request<MoreAppForm>(
      `/customers/${encodeURIComponent(this.cfg.customerId)}/forms/${encodeURIComponent(String(formId))}`,
    );
  }
}
