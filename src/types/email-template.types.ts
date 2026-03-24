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

export type EmailTemplate = {
  enabled: boolean;
  subject: string;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  emailBody: string;
  attachPDF: boolean;
  pdfTemplate: string;
  pdfFilename: string;
  pdfBase64?: string;
  pdfMappings?: PdfFieldMapping[];
  excelBase64?: string;
  excelMappings?: ExcelFieldMapping[];
  excelFilename?: string;
  excelLogoBase64?: string; // Logo personalizado para el Excel/PDF
};

export type FormSubmission = {
  id: string;
  formId: string;
  folderId: string;
  data: Record<string, unknown>;
  submittedAt: string;
};