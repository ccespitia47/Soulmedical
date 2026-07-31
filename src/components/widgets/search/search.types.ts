// ── Tipos del widget Search ───────────────────────────────────────────────────

export type SearchSourceType =
  | "form_submissions" // Registros de otro formulario del mismo proyecto
  | "group"           // Grupos del sistema
  | "google_sheets"   // Google Sheets público
  | "excel_web"       // Excel publicado en web
  | "sql";            // Consulta SQL vía endpoint del backend

// Mapeo de campo de la fuente → campo del formulario actual (para rellenar)
export type FieldMapping = {
  sourceField: string;   // Nombre/key del campo en la fuente de datos
  targetWidgetId: string; // ID del widget en el formulario actual a rellenar
};

export type SearchWidgetConfig = {
  // Fuente de datos
  sourceType: SearchSourceType;

  // Para form_submissions
  sourceFormId?: string;
  sourceFormName?: string;
  searchableFields?: string[]; // IDs de campos buscables del form fuente
  displayField?: string;       // Campo a mostrar en el resultado

  // Para group
  groupId?: string;
  groupName?: string;

  // Para google_sheets
  sheetsUrl?: string;
  sheetsRange?: string; // Legacy: "Hoja1!A:D". Se preserva por retrocompat pero
                        // los widgets nuevos identifican la hoja por gid.
  sheetsGid?: string;   // gid de la hoja específica (extraído de la URL).
  sheetsSearchCol?: string; // Header de la columna donde buscar

  // Para excel_web
  excelUrl?: string;
  excelSearchCol?: string;

  // Para sql
  sqlEndpoint?: string; // URL del endpoint que recibe { q: string } y devuelve rows

  // Columnas a mostrar en el modal de resultados
  displayColumns?: { key: string; label: string }[];

  // Mappings: al seleccionar un resultado, rellena otros campos
  fieldMappings?: FieldMapping[];

  // UI
  placeholder?: string;
  minChars?: number; // Mínimo de caracteres para disparar búsqueda
};