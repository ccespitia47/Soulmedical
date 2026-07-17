// Tipos compartidos del Consentimiento de Vacunación multi-entidad.
// Fuente de verdad de los IDs de campo/pregunta: cada `id` debe existir como
// widget con el mismo id en backend/src/consents/consents.seeder.ts.

export type ConsentFieldType = "text" | "email" | "tel" | "date" | "select" | "number";

export type ConsentField = {
  id: string;
  label: string;
  type: ConsentFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Ocupa media columna en la grilla (por defecto, columna completa). */
  half?: boolean;
};

export type ThirdLabel = "No aplica" | "No está seguro";

/** Pregunta con respuesta Sí / No / (tercera opción) y "indique" opcional. */
export type TriStateQ = {
  id: string;
  /** Número visible en el PDF (ej. "1", "7"). */
  num: string;
  text: string;
  thirdLabel: ThirdLabel;
  /** Campo de texto libre asociado ("De ser así, indique:"). */
  note?: { id: string; label: string };
  required?: boolean;
};

/** Grupo de casillas (Sección A: condiciones). Se guarda como "A; B; C". */
export type ConditionsGroup = {
  id: string;
  label: string;
  options: string[];
};

export type VaccineTableColumn = { id: string; label: string };

export type EntityConfig = {
  meta: {
    key: EntityKey;
    formId: string;
    /** Nombre legal completo para textos ("SOULMEDICAL LTDA"). */
    entidadNombre: string;
    /** Etiqueta corta para dropdown y encabezado ("SOUL"). */
    displayName: string;
    codigo: string;
    version: string;
    /** Fecha de emisión del formato oficial (recuadro del encabezado). */
    fechaFormato: string;
    /** URL importada del logo (Vite resuelve el import a string). */
    logo: string;
  };
  datosGenerales: ConsentField[];
  seccionA: {
    /** Solo SOUL: años desde última vacuna de tétanos. */
    tetanosAnios?: ConsentField;
    condiciones: ConditionsGroup;
    antineumococica: TriStateQ;
    antineumococicaFecha: ConsentField;
    herpesZoster: TriStateQ;
  };
  /** Preguntas 1-6 (todas las vacunas). */
  seccionB: TriStateQ[];
  /** Preguntas 7-13 (vacunas de virus vivos). */
  virusVivos: TriStateQ[];
  seccionC: { columns: VaccineTableColumn[] };
  /** Solo SAI: bloque informativo de efectos adversos (párrafos). */
  efectosAdversos?: string[];
  /** Texto de consentimiento (verbatim del PDF). Párrafos separados por \n\n. */
  legalText: string;
  /** Texto de Habeas Data (verbatim del PDF). */
  habeasData: string;
  firmas: {
    firmaPaciente: { id: string; label: string };
    firmaResponsable: { id: string; label: string };
  };
};

export type EntityKey = "soul" | "sai";

// IDs especiales usados por el flujo de envío (espejo del seeder).
export const ACCEPT_FIELD_ID = "aceptaConsentimiento";
export const SIGNATURE_FIELD_ID = "firma";
export const SIGNATURE_RESP_FIELD_ID = "firmaResponsable";
export const PATIENT_EMAIL_FIELD_ID = "pacienteEmail";
export const PATIENT_NAME_FIELD_ID = "pacienteNombre";
export const PATIENT_DOC_FIELD_ID = "pacienteNumDoc";

// Carpeta lógica del sistema (compartida por ambas entidades).
export const CONSENT_FOLDER_ID = "consent-system-folder";
// Correo de clínica (copia siempre). Editable.
export const CLINIC_EMAIL = "consentimientos@gruposoul.com";
