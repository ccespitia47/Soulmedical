import type { EmailTemplate } from "../types/email-template.types";
import type { AppUser } from "../store/useUsersStore";
import type { AuthUser } from "../types/auth.types";

// Email vive en el backend NestJS (módulo EmailModule).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type EmailAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

export type EmailUserRecipient = Pick<
  AppUser,
  "id" | "email" | "name" | "role" | "avatar"
>;

export type SendEmailPayload = {
  template: EmailTemplate;
  formData: Record<string, string>;
  users: EmailUserRecipient[];
  currentUser?: AuthUser;
  /** PDFs ya generados en el cliente, listos para reenviar a Graph. */
  attachments?: EmailAttachment[];
};

function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text.replace(/\$\{([^}]+)\}/g, (_, key) => data[key] ?? "");
}

export async function sendFormEmail({
  template,
  formData,
  users,
  currentUser,
  attachments = [],
}: SendEmailPayload): Promise<{ success: boolean; message: string; recipients?: number }> {
  if (!template.enabled) {
    return { success: false, message: "Email no habilitado para este formulario" };
  }

  const subject = replacePlaceholders(template.subject, formData);
  const emailBody = replacePlaceholders(template.emailBody, formData);

  const payload = {
    subject,
    emailBody,
    senderName: template.senderName ?? "",
    replyTo: template.replyTo ?? "",
    toRecipients: template.toRecipients ?? [],
    ccRecipients: template.ccRecipients ?? [],
    bccRecipients: template.bccRecipients ?? [],
    users,
    currentUserEmail: currentUser?.email ?? null,
    formData,
    attachments,
  };

  // El endpoint /api/email/send requiere JWT (hardening de seguridad):
  // solo usuarios autenticados pueden disparar envíos de correo arbitrarios.
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/email/send`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || "Error al enviar el email");
  }

  return data;
}
