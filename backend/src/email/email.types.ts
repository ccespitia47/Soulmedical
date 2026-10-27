export type EmailRecipient =
  | { type: 'static'; id?: string; email: string }
  | { type: 'group'; id?: string; group: string; groupLabel?: string }
  // 'field' apunta a un widget del formulario.
  // - Sin `column`: el valor directo del widget es el email (text/email/select).
  // - Con `column`: el widget es una búsqueda (search); el frontend serializa
  //   la fila seleccionada en `formData[widgetId+'__row']` y acá se lee
  //   `row[column]` para obtener el email (ej. `ciudadDepartamento.email2`).
  | {
      type: 'field';
      id?: string;
      widgetId: string;
      widgetLabel?: string;
      column?: string;
    }
  // 'lookup' es un lookup externo contra un Google Sheet aparte.
  // El backend no fetchea el Sheet; el navegador resuelve el valor y lo
  // envía en `resolvedRecipients[recipient.id]` al endpoint de submit.
  | {
      type: 'lookup';
      id?: string;
      widgetId: string;
      widgetLabel?: string;
      sheetUrl: string;
      matchColumn: string;
      emailColumn: string;
    };

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
  /** Mapa de recipient.id → email (ya resuelto en el navegador). Se usa
   *  para destinatarios tipo 'lookup' que el backend no puede resolver
   *  solo (no habla con Google Sheets). Cada key es `recipient.id`. */
  resolvedRecipients?: Record<string, string>;
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
  /** Tipo de descarga enlazada. Default 'excel' para retrocompatibilidad. */
  kind?: 'excel' | 'bulk-pdf';
  /** Cantidad de PDFs generados. Solo aplica cuando kind === 'bulk-pdf'. */
  count?: number;
};

export type SendEmailResult = {
  success: boolean;
  message: string;
  recipients: number;
};
