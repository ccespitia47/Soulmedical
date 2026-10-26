/**
 * Catálogo de widgets soportados por SoulForms.
 *
 * Fuente de verdad: `src/components/widgets/<name>/<Name>Widget.ts` del
 * proyecto principal. Si se añaden widgets nuevos ahí, hay que replicarlos
 * aquí (o leerlos del repo con un script generador — futuro).
 *
 * Cada entrada expone:
 *  - type: id interno que persiste en Mongo (NO cambiar; romperá submissions).
 *  - label: nombre visible en el builder (español).
 *  - defaultConfig: valores que el builder usa al dropear el widget.
 *  - editableConfigKeys: campos que el panel de propiedades deja editar.
 *  - description: una línea para que Claude sepa cuándo elegirlo.
 */

export interface WidgetTypeInfo {
  type: string;
  label: string;
  icon: string;
  defaultConfig: Record<string, unknown>;
  editableConfigKeys: string[];
  description: string;
}

export const WIDGET_CATALOG: WidgetTypeInfo[] = [
  {
    type: "text",
    label: "Texto",
    icon: "text",
    defaultConfig: {
      placeholder: "",
      defaultValue: "",
      maxLength: 100,
      allowNumbers: false,
      allowSpecialChars: false,
      allowLineBreaks: false,
    },
    editableConfigKeys: [
      "placeholder",
      "defaultValue",
      "maxLength",
      "allowNumbers",
      "allowSpecialChars",
      "allowLineBreaks",
    ],
    description:
      "Entrada de texto en una línea con restricciones de longitud y clase de caracteres.",
  },
  {
    type: "textarea",
    label: "Párrafo",
    icon: "textarea",
    defaultConfig: { placeholder: "", maxLength: 500, rows: 4 },
    editableConfigKeys: ["placeholder", "maxLength", "rows"],
    description:
      "Texto multi-línea (párrafo) con control de longitud y número de filas.",
  },
  {
    type: "number",
    label: "Número",
    icon: "number",
    defaultConfig: {
      placeholder: "",
      min: 0,
      max: 999999,
      step: 1,
      allowDecimals: false,
    },
    editableConfigKeys: ["placeholder", "min", "max", "step", "allowDecimals"],
    description:
      "Entrada numérica con cotas min/max/step y decimales opcionales.",
  },
  {
    type: "email",
    label: "Email",
    icon: "email",
    defaultConfig: { placeholder: "correo@ejemplo.com" },
    editableConfigKeys: ["placeholder"],
    description: "Entrada de email con validación built-in.",
  },
  {
    type: "phone",
    label: "Teléfono",
    icon: "phone",
    defaultConfig: {
      placeholder: "300 123 4567",
      prefix: "+57",
      maxLength: 10,
      enableCountrySelector: false,
      defaultCountry: "CO",
    },
    editableConfigKeys: [
      "placeholder",
      "prefix",
      "maxLength",
      "enableCountrySelector",
      "defaultCountry",
    ],
    description:
      "Teléfono con selector de país (LATAM+ES+US) y límite de longitud.",
  },
  {
    type: "date",
    label: "Fecha",
    icon: "date",
    defaultConfig: { min: "", max: "" },
    editableConfigKeys: ["min", "max"],
    description: "Selector de fecha con cotas opcionales.",
  },
  {
    type: "time",
    label: "Hora",
    icon: "clock",
    defaultConfig: { nowByDefault: false, rememberInput: false },
    editableConfigKeys: ["nowByDefault", "rememberInput"],
    description: "Selector HH:MM, opcionalmente pre-llenado con la hora actual.",
  },
  {
    type: "select",
    label: "Desplegable",
    icon: "select",
    defaultConfig: {
      placeholder: "Selecciona una opción",
      options: ["Opción 1", "Opción 2", "Opción 3"],
      defaultValue: "",
      sortAlphabetically: false,
      multiple: false,
      expand: false,
      rememberEntry: false,
    },
    editableConfigKeys: [
      "options",
      "sortAlphabetically",
      "multiple",
      "expand",
      "rememberEntry",
      "defaultValue",
      "placeholder",
    ],
    description:
      "Dropdown con selección única o múltiple, opcionalmente expandido como radio/checkbox.",
  },
  {
    type: "radio",
    label: "Radio",
    icon: "radio",
    defaultConfig: {
      options: [
        { id: "opt_1", label: "Opción 1" },
        { id: "opt_2", label: "Opción 2" },
      ],
      useImageLabels: false,
      defaultValue: "",
      verticalAlign: true,
      rememberInput: false,
    },
    editableConfigKeys: [
      "options",
      "useImageLabels",
      "defaultValue",
      "verticalAlign",
      "rememberInput",
    ],
    description:
      "Grupo de radio buttons de selección única; opciones pueden tener imagen.",
  },
  {
    type: "checkbox",
    label: "Casillas",
    icon: "checkbox",
    defaultConfig: { options: ["Opción 1", "Opción 2", "Opción 3"] },
    editableConfigKeys: ["options"],
    description:
      "Grupo de checkboxes para selección múltiple sobre una lista de strings.",
  },
  {
    type: "signature",
    label: "Firma",
    icon: "signature",
    defaultConfig: { penColor: "#000000", penWidth: 2 },
    editableConfigKeys: ["penColor", "penWidth", "assignedStep"],
    description: "Pad de firma manuscrita; genera imagen de la rúbrica.",
  },
  {
    type: "photo",
    label: "Foto",
    icon: "photo",
    defaultConfig: { allowCamera: true, allowUpload: true, maxSizeMB: 5 },
    editableConfigKeys: ["maxSizeMB", "allowCamera", "allowUpload"],
    description:
      "Captura/subida de foto (cámara o galería) con tope de tamaño.",
  },
  {
    type: "file",
    label: "Archivo",
    icon: "file",
    defaultConfig: { fileType: "documents", maxSizeMB: 25 },
    editableConfigKeys: ["fileType", "maxSizeMB"],
    description: "Subida genérica de archivo (documentos por defecto).",
  },
  {
    type: "video",
    label: "Video",
    icon: "video",
    defaultConfig: { maxDurationSecs: 60, maxSizeMB: 100 },
    editableConfigKeys: ["maxDurationSecs", "maxSizeMB"],
    description:
      "Captura/subida de video con tope de duración y tamaño (backend tope 200MB).",
  },
  {
    type: "image",
    label: "Imagen",
    icon: "image",
    defaultConfig: {
      src: "",
      mediaId: "",
      maxWidth: 180,
      maxHeight: null,
      clickable: false,
    },
    editableConfigKeys: ["src", "mediaId", "maxWidth", "maxHeight", "clickable"],
    description:
      "Imagen/logo estático en el formulario con tamaño configurable.",
  },
  {
    type: "header",
    label: "Encabezado",
    icon: "header",
    defaultConfig: { text: "Sección", size: "medium", showDivider: true },
    editableConfigKeys: ["text", "size", "showDivider"],
    description:
      "Encabezado de sección para separar visualmente grupos de campos.",
  },
  {
    type: "html_block",
    label: "Bloque HTML",
    icon: "html",
    defaultConfig: {
      html: '<h4 style="text-align:right;"><strong><span style="color:#99cc00;">TÍTULO DEL FORMULARIO</span></strong></h4>\n<p style="text-align:right;"><span style="color:#999999;">Dirección de la institución</span></p>',
      height: "auto",
    },
    editableConfigKeys: ["html"],
    description:
      "Bloque de HTML enriquecido (branding, títulos custom, textos legales).",
  },
  {
    type: "subform",
    label: "Subformulario",
    icon: "🗂️",
    defaultConfig: {
      addButtonLabel: "Agregar",
      fields: [],
      minEntries: 0,
      maxEntries: 0,
    },
    editableConfigKeys: [
      "fields",
      "rules",
      "addButtonLabel",
      "minEntries",
      "maxEntries",
    ],
    description:
      "Grupo repetible anidado: colecciona N entradas de sub-campos.",
  },
  {
    type: "search",
    label: "Búsqueda",
    icon: "search",
    defaultConfig: {
      sourceType: "form_submissions",
      placeholder: "Buscar...",
      minChars: 2,
      displayColumns: [],
      fieldMappings: [],
      searchableFields: [],
    },
    editableConfigKeys: [
      "sourceType",
      "sheetsUrl",
      "sheetsGid",
      "excelUrl",
      "sourceFormId",
      "displayColumns",
      "fieldMappings",
      "placeholder",
      "minChars",
      "searchableFields",
      "displayField",
      "groupId",
      "sheetsSearchCol",
      "excelSearchCol",
      "sqlEndpoint",
    ],
    description:
      "Typeahead contra submissions, Google Sheets, Excel o SQL que autollena campos mapeados.",
  },
  {
    type: "calc",
    label: "Cálculo",
    icon: "calc",
    defaultConfig: {
      operator: "sum",
      terms: [],
      initialValue: "",
      decimalPrecision: 2,
      ignoreInvalid: true,
      ignoreHidden: false,
      isPrice: false,
      currency: "COP",
    },
    editableConfigKeys: [
      "terms",
      "operator",
      "initialValue",
      "decimalPrecision",
      "ignoreInvalid",
      "ignoreHidden",
      "isPrice",
      "currency",
    ],
    description:
      "Campo computado (read-only) sum/avg/etc sobre otros widgets, con moneda opcional.",
  },
  {
    type: "price",
    label: "Precio",
    icon: "price",
    defaultConfig: {
      currency: "COP",
      decimalMark: "comma",
      decimalPrecision: 2,
      minAmount: "",
      maxAmount: "",
      rememberInput: false,
    },
    editableConfigKeys: [
      "currency",
      "decimalMark",
      "decimalPrecision",
      "minAmount",
      "maxAmount",
      "rememberInput",
    ],
    description:
      "Entrada monetaria con formato por moneda y marca decimal local.",
  },
  {
    type: "barcode",
    label: "Código de Barras/Cédula",
    icon: "📷",
    defaultConfig: {
      scannerEnabled: true,
      cameraType: "rear",
      format: "code_128",
      autoSubmit: true,
      placeholder: "Escanee o ingrese manualmente",
    },
    editableConfigKeys: ["scannerEnabled", "placeholder"],
    description:
      "Scanner de códigos de barras / cédulas con entrada manual opcional.",
  },
  {
    type: "id_scanner",
    label: "Cédula",
    icon: "id",
    defaultConfig: {
      fields: ["nombre", "numero", "fechaNacimiento"],
      allowManual: true,
      documentType: "auto",
    },
    editableConfigKeys: ["fields", "allowManual", "documentType"],
    description:
      "Escanea cédulas colombianas (PDF417/MRZ) y extrae campos seleccionados.",
  },
  {
    type: "id_document",
    label: "Documento de identidad",
    icon: "idCard",
    defaultConfig: {
      countries: ["CO"],
      defaultCountry: "CO",
      thousandsSeparator: "none",
    },
    editableConfigKeys: ["countries", "defaultCountry", "thousandsSeparator"],
    description:
      "Entrada de documento de identidad con país; pre-configurado para Colombia.",
  },
  {
    type: "quiz_question",
    label: "Pregunta de evaluación",
    icon: "help",
    defaultConfig: {
      mode: "single",
      scoreMode: "correct",
      options: [
        { id: "opt_1", label: "Opción 1", points: 1, correct: true },
        { id: "opt_2", label: "Opción 2", points: 0, correct: false },
      ],
    },
    editableConfigKeys: ["options", "mode", "scoreMode"],
    description:
      "Pregunta evaluada (una o múltiples respuestas) con puntos por opción o flag correct.",
  },
  {
    type: "quiz_score",
    label: "Nota final",
    icon: "award",
    defaultConfig: {
      includeQuestions: "all",
      includedIds: [],
      visibility: "visible",
      showMax: true,
      decimalPrecision: 1,
      showAnswersReview: false,
      showCorrectness: false,
    },
    editableConfigKeys: [
      "includeQuestions",
      "includedIds",
      "visibility",
      "showMax",
      "decimalPrecision",
      "showAnswersReview",
      "showCorrectness",
    ],
    description:
      "Agrega puntos de quiz_question en una nota final con revisión opcional.",
  },
];

export function findWidgetType(type: string): WidgetTypeInfo | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}
