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

export type RecipientType = "static" | "group" | "field" | "lookup";

export type EmailRecipient = {
  id: string;
  type: RecipientType;
  // type === "static": correo fijo
  email?: string;
  // type === "group": todos los usuarios de ese rol
  group?: string; // "admin" | "coordinator" | "user" | nombre de grupo custom
  groupLabel?: string; // Etiqueta visible: "Administradores", "Coordinadores", etc.
  // type === "field": apunta a un widget específico del formulario.
  // - Si solo widgetId: el VALOR directo del widget se usa como email
  //   (sirve para text/email/select que ya contienen el correo).
  // - Si widgetId + column: el widget es una búsqueda (search). Se lee la
  //   fila que el usuario seleccionó (serializada en formData[widgetId+'__row'])
  //   y se toma `row[column]` como email. Permite, por ejemplo,
  //   "ciudadDepartamento.email", "ciudadDepartamento.email2", etc.
  widgetId?: string;
  widgetLabel?: string; // Etiqueta visible: "Correo del paciente"
  column?: string;      // Nombre de columna de la fuente (solo widgets search)
  // type === "lookup": lookup externo en un Google Sheet aparte.
  // - El widget `widgetId` (desplegable, texto, search, lo que sea) aporta
  //   el valor de match (ej. "Bogotá").
  // - El navegador fetchea `sheetUrl`, busca la fila donde
  //   row[matchColumn] === valorDelWidget y extrae row[emailColumn].
  // - Como el backend no habla con Sheets, el navegador resuelve y manda
  //   `resolvedRecipients[recipient.id]` al endpoint de submit.
  sheetUrl?: string;
  matchColumn?: string;
  emailColumn?: string;
};

export type EmailTemplate = {
  // Identificador estable de ESTA configuración dentro del array
  // `FormItem.emailTemplates`. Lo asigna el frontend al crearla; para
  // formularios viejos (singular legacy) se sintetiza al hidratar.
  // Permite al backend recibir attachments taggeados por template y
  // enrutarlos al dispatch correcto (ver flujo de tasks).
  id?: string;
  enabled: boolean;
  subject: string;
  // Etiqueta visible de ESTA notificación en la UI del admin — "Operaciones",
  // "Aseguradora", etc. No llega al correo final; solo sirve para distinguir
  // paneles cuando hay varias configuraciones en el mismo formulario.
  label?: string;
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