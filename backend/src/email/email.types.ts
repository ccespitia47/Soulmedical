export type EmailRecipient =
  | { type: 'static'; email: string }
  | { type: 'group'; group: string; groupLabel?: string };

export type EmailUserRef = {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

export type EmailAttachment = {
  name: string;
  contentType: string;
  /** Contenido en base64 (sin prefijo `data:...`). */
  contentBytes: string;
};

export type SendEmailPayload = {
  subject: string;
  emailBody: string;
  senderName?: string;
  replyTo?: string;
  toRecipients: EmailRecipient[];
  ccRecipients?: EmailRecipient[];
  bccRecipients?: EmailRecipient[];
  users?: EmailUserRef[];
  currentUserEmail?: string | null;
  formData?: Record<string, string>;
  /** PDFs ya generados en el cliente. */
  attachments?: EmailAttachment[];
};

export type SendPasswordResetPayload = {
  to: string;
  name: string;
  resetUrl: string;
};

export type SendPublicFormOtpPayload = {
  to: string;
  formName: string;
  code: string;
  /** Minutos de vida del código (para mostrar en el mensaje). */
  ttlMinutes: number;
};

export type SendTwoFactorResetNoticePayload = {
  to: string;
  /** Nombre del usuario al que se reseteó el 2FA. */
  userName: string;
  /** Nombre del admin que ejecutó el reset (para trazabilidad). */
  actorName?: string;
};

export type SendReportEmailPayload = {
  to: string;
  userName: string;
  formName: string;
  attachment: EmailAttachment;
};

export type SendReportLinkPayload = {
  to: string;
  userName: string;
  formName: string;
  url: string;
  expiresInMinutes: number;
};

export type SendEmailResult = {
  success: boolean;
  message: string;
  recipients: number;
};
