// Tipos para el sistema de plantillas de email

export type ExcelFieldMapping = {
  coord: string;        // Coordenada de la celda: "A1", "B5", etc.
  placeholder: string;  // Ej: "${nombre}"
  description: string;  // Label del campo del formulario
};

export type PdfFieldMapping = {
  placeholder: string;
  x: number;
  y: number;
  page: number;
  fontSize?: number;
  fieldLabel: string;
};

// ─── Destinatarios ────────────────────────────────────────────────────────────

export type RecipientType = "static" | "group";

export type EmailRecipient = {
  id: string;
  type: RecipientType;
  // type === "static": correo fijo
  email?: string;
  // type === "group": todos los usuarios de ese rol
  group?: string; // "admin" | "coordinator" | "user" | nombre de grupo custom
  groupLabel?: string; // Etiqueta visible: "Administradores", "Coordinadores", etc.
};

export type EmailTemplate = {
  enabled: boolean;
  subject: string;
  // Remitente
  senderName?: string;      // Nombre visible del remitente: "Grupo Soul - SoulForms"
  replyTo?: string;         // Correo de respuesta (opcional)
  // Campos legacy (string simple) — se mantienen por compatibilidad
  to: string;
  cc?: string;
  bcc?: string;
  // Nuevos campos de destinatarios dinámicos
  toRecipients?: EmailRecipient[];
  ccRecipients?: EmailRecipient[];
  bccRecipients?: EmailRecipient[];
  emailBody: string;
  attachPDF: boolean;
  pdfTemplate: string;
  pdfFilename: string;
  pdfBase64?: string;
  pdfMappings?: PdfFieldMapping[];
  excelBase64?: string;
  excelMappings?: ExcelFieldMapping[];
  excelFilename?: string;
  excelLogoBase64?: string;
};

export type FormSubmission = {
  id: string;
  formId: string;
  folderId: string;
  data: Record<string, unknown>;
  submittedAt: string;
};