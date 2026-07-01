import type { EmailTemplate } from "../types/email-template.types";
import type { AppUser } from "../store/useUsersStore";
import type { AuthUser } from "../types/auth.types";

const EMAIL_SERVICE_URL =
  import.meta.env.VITE_EMAIL_SERVICE_URL ?? "http://localhost:3003";

export type EmailAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

export type EmailUserRecipient = Pick<AppUser, "id" | "email" | "name" | "role" | "avatar" | "assignments">;

export type SendEmailPayload = {
  template: EmailTemplate;
  formData: Record<string, string>;
  users: EmailUserRecipient[];
  currentUser?: AuthUser;
  attachments?: EmailAttachment[];
  excelHtml?: string;  // HTML del Excel para que el servidor genere el PDF
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
  excelHtml,
}: SendEmailPayload): Promise<{ success: boolean; message: string; recipients?: number }> {
  if (!template.enabled) {
    return { success: false, message: "Email no habilitado para este formulario" };
  }

  const subject   = replacePlaceholders(template.subject,   formData);
  const emailBody = replacePlaceholders(template.emailBody, formData);

  const payload = {
    subject,
    emailBody,
    senderName:    template.senderName   ?? "",
    replyTo:       template.replyTo      ?? "",
    toRecipients:  template.toRecipients  ?? [],
    ccRecipients:  template.ccRecipients  ?? [],
    bccRecipients: template.bccRecipients ?? [],
    users,
    currentUserEmail: currentUser?.email ?? null,
    formData,
    // PDF desde plantilla HTML
    attachPDF:    template.attachPDF ?? false,
    pdfTemplate:  template.pdfTemplate ?? "",
    pdfFilename:  template.pdfFilename ?? "formulario.pdf",
    // PDF desde Excel mapeado
    excelHtml:    excelHtml ?? null,
    excelFilename: template.excelFilename?.replace(/\.xlsx?$/i, ".pdf") ?? "formulario.pdf",
    attachments,
  };

  const res = await fetch(`${EMAIL_SERVICE_URL}/api/send-email`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Error al enviar el email");
  }

  return data;
}