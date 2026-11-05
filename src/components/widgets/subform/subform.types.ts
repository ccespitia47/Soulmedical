export type SubformFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "radio"
  // ── Nuevos (portados del formulario principal, versión simplificada) ──
  | "time"
  | "price"
  | "header"
  | "htmlblock"
  | "image"
  | "video"
  | "file"
  | "barcode"
  | "idscanner"
  | "idDocument"
  | "signature"
  | "photo"
  | "search"
  | "calc"
  | "quiz_question"
  | "quiz_score"
  // ── Subform anidado (ver `childFields` + `childRules` en SubformField). ──
  | "subform";

/**
 * ── Deuda técnica: renames pendientes contra el schema del formulario
 * principal (postpuestos para no romper configuraciones ya guardadas).
 * Cuando se aborden, hacerlos con capa de compat (leer ambos nombres,
 * escribir al nuevo) y eliminar la capa después de 6 meses.
 *
 *   SUBFORM            →  MAIN
 *   rememberInput      →  rememberEntry
 *   decimalMark "dot"  →  decimalMark "point"
 *   headerText         →  text
 *   headerSize         →  size
 *   htmlContent        →  html
 *   idscannerFields    →  fields
 *   calcOperator       →  operator
 *   url / imageFileId  →  src / mediaId         (image)
 *
 * Ver también el audit MAIN↔SUBFORM en la conversación de 2026-11.
 */

export type SubformField = {
  id: string;
  type: SubformFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  // ── Configs específicas de widgets portados ──
  /**
   * URL (para image/video) o contenido HTML (htmlblock).
   * TODO rename (image): `url` → `src` para match con main.
   */
  url?: string;
  /** TODO rename (htmlblock): `htmlContent` → `html` para match con main. */
  htmlContent?: string;
  /** price: prefijo visual (ej. "$", "COP"). */
  pricePrefix?: string;
  /** file: filtro MIME (ej. "application/pdf,image/*"). */
  accept?: string;
  /** calc: fórmula simple con ids de campos del mismo subform. Ej. "a+b*2". */
  formula?: string;
  /**
   * quiz_question (legacy): índice de la opción correcta (0-based) cuando
   * `quizOptions` NO está presente. Se mantiene para no romper configs ya
   * guardadas — al abrir el editor se migra a `quizOptions`.
   */
  correctOptionIndex?: number;
  /**
   * quiz_question (legacy): puntos globales de la pregunta cuando
   * `quizOptions` NO está presente. En modo estructurado, cada opción
   * tiene sus propios `points`.
   */
  points?: number;
  /**
   * quiz_question: tipo de respuesta. `single` = radio (default, compat),
   * `multi` = checkbox (varias opciones correctas). En `multi` el valor
   * se serializa como JSON string de array de labels seleccionados.
   * Alias del `mode` del widget main (renombrado acá para no colisionar
   * con otros fields que puedan usar `mode`).
   */
  quizMode?: "single" | "multi";
  /**
   * quiz_question: modo de puntuación. `correct` = cada opción marcada
   * correcta vale 1 pt; `weighted` = el admin define los puntos por opción
   * libremente (incluso negativos).
   */
  scoreMode?: "correct" | "weighted";
  /**
   * quiz_question: opciones estructuradas — forma canónica alineada con
   * el main widget. Cuando está presente, el runtime y el scoring IGNORAN
   * `options`, `correctOptionIndex` y `points` legacy. Si NO está presente,
   * se deriva on-read de los legacy en el builder/runtime/scoring para
   * mantener compat con configs viejas.
   */
  quizOptions?: Array<{
    id: string;
    label: string;
    points: number;
    correct: boolean;
  }>;
  /** radio: orientación de las opciones (default true = vertical). */
  verticalAlign?: boolean;
  /** radio: cuando true, cada opción se muestra con una imagen encima del label. */
  useImageLabels?: boolean;
  /**
   * radio: opciones "ricas" con id/label + imagen opcional. Se usa cuando
   * `useImageLabels=true`. Si está vacío, el runtime cae a `options: string[]`.
   */
  radioOptions?: Array<{
    id: string;
    label: string;
    imageUrl?: string;
    imageId?: string;
  }>;
  /**
   * radio / text / price / select: persiste la última entrada en localStorage.
   * TODO rename: `rememberInput` → `rememberEntry` para match con main.
   */
  rememberInput?: boolean;

  // ── text ─────────────────────────────────────────────────────────────
  /** text: longitud máxima permitida. */
  maxLength?: number;
  /** text: permitir dígitos (default true). */
  allowNumbers?: boolean;
  /** text: permitir caracteres especiales (default true). */
  allowSpecialChars?: boolean;
  /** text: permitir Enter (convierte el input en textarea-like). */
  allowLineBreaks?: boolean;
  /** textarea: filas iniciales (default 3). */
  rows?: number;

  // ── number ───────────────────────────────────────────────────────────
  /** number: valor mínimo. */
  min?: number;
  /** number: valor máximo. */
  max?: number;
  /** number: paso del input. */
  step?: number;
  /** number: permitir decimales (default true). */
  allowDecimals?: boolean;

  // ── price ────────────────────────────────────────────────────────────
  /** price: código de moneda (COP, USD, EUR, MXN…). */
  currency?: string;
  /**
   * price: separador decimal.
   * TODO rename: aceptar también `"point"` (el main usa esa variante);
   * hoy solo `"comma" | "dot"`. Al alinear, mapear `"dot"` → `"point"`
   * con capa de compat para configs guardadas.
   */
  decimalMark?: "comma" | "dot";
  /** price / calc / quiz_score: número de decimales a mostrar. */
  decimalPrecision?: number;
  /** price: monto mínimo. */
  minAmount?: number;
  /** price: monto máximo. */
  maxAmount?: number;

  // ── select ───────────────────────────────────────────────────────────
  /** select: ordena A→Z las opciones en editor y render. */
  sortAlphabetically?: boolean;
  /** select: permite múltiples selecciones. */
  multiple?: boolean;
  /** select: renderiza expandido (radios/checkboxes) en vez de dropdown. */
  expand?: boolean;

  // ── signature ────────────────────────────────────────────────────────
  /** signature: color del trazo. */
  penColor?: string;
  /** signature: grosor del trazo en px. */
  penWidth?: number;
  /** signature: en tareas multi-destinatario, número del paso (1, 2…) que debe firmar; 0 = cualquiera. */
  assignedStep?: number;

  // ── calc ─────────────────────────────────────────────────────────────
  /**
   * calc: operador aplicado a los campos referenciados.
   * TODO rename: `calcOperator` → `operator` para match con main.
   * (Prop solo vive aquí → rename puro, bajo riesgo.)
   */
  calcOperator?: "sum" | "subtract" | "multiply" | "divide" | "average" | "min" | "max" | "count";
  /** calc: valor inicial a sumar al resultado. */
  initialValue?: number;
  /** calc: ignorar valores no numéricos (default true). */
  ignoreInvalid?: boolean;
  /** calc: ignorar campos ocultos por reglas (default false). Paridad con main. */
  ignoreHidden?: boolean;
  /** calc: mostrar como precio con el prefijo `pricePrefix`. */
  isPrice?: boolean;
  /**
   * calc: lista estructurada de términos — forma canónica alineada con el
   * widget calc del main. Cuando está presente, el runtime la usa en vez
   * del `formula` legacy o del fallback "aplica operador a todos los
   * números del row". Cada term es o bien un `widget` (referencia por
   * fieldId a OTRO campo del mismo subform row) o un valor `fixed`.
   *
   * Si está ausente, se mantiene el comportamiento legacy:
   *   1. `formula` textual si existe.
   *   2. `calcOperator` aplicado a todos los campos number/price/calc.
   */
  calcTerms?: Array<{
    type: "widget" | "fixed";
    /** widget: fieldId de otro campo del MISMO subform row. */
    widgetId?: string;
    /** fixed: valor numérico literal. */
    value?: number;
  }>;

  // ── quiz_score ───────────────────────────────────────────────────────
  /** quiz_score: incluir todas las preguntas o solo las de `includedIds`. */
  includeQuestions?: "all" | "select";
  /** quiz_score: ids de las preguntas a sumar (cuando includeQuestions="select"). */
  includedIds?: string[];
  /** quiz_score: "visible" siempre, "after_submit" solo tras enviar, "hidden". */
  visibility?: "visible" | "after_submit" | "hidden";
  /** quiz_score: mostrar también el puntaje máximo (ej. "7.5 / 10"). */
  showMax?: boolean;

  // ── phone ────────────────────────────────────────────────────────────
  /** phone: prefijo fijo mostrado (+57, +1…). */
  prefix?: string;
  /** phone: muestra un selector de país que sobrescribe `prefix` en runtime. */
  enableCountrySelector?: boolean;
  /** phone: código ISO del país por defecto cuando enableCountrySelector=true (ej. "CO"). */
  defaultCountry?: string;

  // ── time ─────────────────────────────────────────────────────────────
  /** time: si está vacío al montar, setea HH:mm actual. */
  nowByDefault?: boolean;

  // ── photo ────────────────────────────────────────────────────────────
  /** photo: permitir abrir la cámara del dispositivo (default true). */
  allowCamera?: boolean;
  /** photo: permitir seleccionar archivo del disco (default true). */
  allowUpload?: boolean;

  // ── photo / file / video (compartido) ────────────────────────────────
  /** photo / file / video: tamaño máximo del archivo en MB. */
  maxSizeMB?: number;

  // ── file ─────────────────────────────────────────────────────────────
  /** file: categoría de archivos permitidos (atajo sobre `accept`). */
  fileType?: "documents" | "images" | "audio" | "video" | "any";

  // ── date ─────────────────────────────────────────────────────────────
  /** date: fecha mínima permitida (YYYY-MM-DD). */
  minDate?: string;
  /** date: fecha máxima permitida (YYYY-MM-DD). */
  maxDate?: string;

  // ── idDocument ───────────────────────────────────────────────────────
  /** idDocument: países habilitados (códigos ISO). Si está vacío = solo CO. */
  countries?: string[];
  // (defaultCountry está arriba, compartido con phone)
  /**
   * idDocument: separador de miles.
   * - String ("none" | "dot" | "comma"): formato alineado con main.
   * - boolean legacy: true→"dot", false→"none" (se mantiene por compat con
   *   configs guardadas antes de este cambio).
   */
  thousandsSeparator?: "none" | "dot" | "comma" | boolean;

  // ── image (view-only — URL externa o upload a GridFS) ────────────────
  /**
   * image: fileId en GridFS cuando la imagen fue subida (no URL externa).
   * TODO rename: `imageFileId` → `mediaId` para match con main.
   */
  imageFileId?: string;
  /** image: ancho máximo en px (null = sin límite). */
  maxWidth?: number;
  /** image: alto máximo en px. */
  maxHeight?: number;
  /** image: abre modal con la imagen ampliada al click. */
  clickable?: boolean;

  // ── video (capture — subido a GridFS como el main widget video) ──────
  /** video: fileId en GridFS tras upload de submission. */
  videoFileId?: string;
  /** video: duración máxima permitida en segundos. */
  maxDurationSecs?: number;

  // ── header ───────────────────────────────────────────────────────────
  /**
   * header: texto del encabezado (separado de `label`).
   * TODO rename: `headerText` → `text` para match con main.
   */
  headerText?: string;
  /**
   * header: tamaño visual (small / medium / large).
   * TODO rename: `headerSize` → `size` para match con main.
   */
  headerSize?: "small" | "medium" | "large";
  /** header: mostrar línea divisoria debajo. */
  showDivider?: boolean;

  // ── barcode ──────────────────────────────────────────────────────────
  /** barcode: habilita botón de "escanear" (preview, sin cámara real). */
  scannerEnabled?: boolean;
  /**
   * barcode: cuál cámara usar cuando haya scanner real. "rear" (trasera) es
   * el default sensato en móvil para escanear códigos físicos; "front" se
   * usa en kioscos o mesas de trabajo donde el código mira al usuario.
   */
  cameraType?: "rear" | "front";
  /**
   * barcode: formato esperado del código. El default `code_128` cubre la
   * mayoría de etiquetas de producto; `ean_13` para retail internacional,
   * `qr_code` para enlaces/payloads JSON, `upc_a` para retail US.
   */
  format?: "code_128" | "ean_13" | "qr_code" | "upc_a";
  /** barcode: al completar el escaneo, dispara submit del formulario. */
  autoSubmit?: boolean;

  // ── idscanner ────────────────────────────────────────────────────────
  /**
   * idscanner: qué campos extraer (nombre, numero, fechaNacimiento, …).
   * TODO rename: `idscannerFields` → `fields` para match con main.
   * (Prop solo vive aquí → rename puro, bajo riesgo.)
   */
  idscannerFields?: string[];

  // ── subform anidado ──────────────────────────────────────────────────
  /**
   * Cuando `type === "subform"`: fields del subformulario anidado.
   * El valor de este field en el entry del padre se serializa como JSON
   * string de `SubformEntry[]` (mismo contrato que un subform top-level).
   * Admite N niveles de anidación.
   */
  childFields?: SubformField[];
  /** Cuando `type === "subform"`: reglas propias del subform anidado. */
  childRules?: SubformRule[];

  // ── search (externo — google sheets / excel web / sql) ───────────────
  /** search: fuente de datos a consultar. */
  searchSource?: "google_sheets" | "excel_web" | "sql";
  /** search: URL del Google Sheet (compartido o publicado). */
  sheetsUrl?: string;
  /** search: gid de la hoja específica (parseado de la URL). */
  sheetsGid?: string;
  /** search: columna por la que se filtra la búsqueda en Sheets. */
  sheetsSearchCol?: string;
  /** search: columnas detectadas del Sheet para poblar displayColumns/mappings. */
  sheetColumns?: string[];
  /** search: URL del Excel publicado en OneDrive/SharePoint. */
  excelUrl?: string;
  /** search: columna por la que se filtra la búsqueda en Excel. */
  excelSearchCol?: string;
  /** search: endpoint backend para consultas SQL (recibe { q }, responde { rows }). */
  sqlEndpoint?: string;
  /** search: columnas que se muestran en el modal de resultados. */
  displayColumns?: { key: string; label: string }[];
  /** search: mínimo de caracteres para disparar la búsqueda (default 2). */
  searchMinChars?: number;
  /**
   * search: al seleccionar un resultado del modal, rellena OTROS fields del
   * mismo subform-row con el valor de la columna indicada de la fuente.
   */
  searchMappings?: Array<{ sourceField: string; targetFieldId: string }>;
  /** idscanner: permitir edición manual del resultado. */
  allowManual?: boolean;
  /** idscanner: tipo de documento (auto / cc / ce / ti / passport). */
  documentType?: "auto" | "cc" | "ce" | "ti" | "passport";
};

export type SubformEntry = Record<string, string>;

export type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

/**
 * Devuelve las opciones canónicas de un `quiz_question`. Si el field ya tiene
 * `quizOptions` estructuradas, las devuelve tal cual. Si no, deriva desde el
 * legacy (`options: string[]` + `correctOptionIndex` + `points` global):
 * cada string se vuelve una `QuizOption`, la del índice correcto queda
 * `correct=true` con los `points` globales, el resto con points=0.
 *
 * El objetivo es que runtime, scoring y builder consuman una sola forma —
 * las configs viejas guardadas en Mongo siguen funcionando sin migración.
 */
export function resolveQuizOptions(field: SubformField): QuizOption[] {
  if (Array.isArray(field.quizOptions) && field.quizOptions.length > 0) {
    return field.quizOptions;
  }
  const strings = field.options || [];
  const correctIdx = field.correctOptionIndex ?? -1;
  const pts = field.points ?? 1;
  return strings.map((label, i) => ({
    id: `legacy_${i}`,
    label,
    points: i === correctIdx ? pts : 0,
    correct: i === correctIdx,
  }));
}

// ── Reglas internas del subformulario ──────────────────────────────────────

export type SubformRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_empty"
  | "is_empty"
  | "has_value";

export type SubformCondition = {
  fieldId: string;
  operator: SubformRuleOperator;
  value: string;
};

export type SubformRule = {
  id: string;
  name: string;
  matchType: "all" | "any";
  conditions: SubformCondition[];
  action: "show" | "hide";
  targetFieldIds: string[];
};

export function evaluateSubformRules(
  rules: SubformRule[],
  values: Record<string, string>
): Set<string> {
  const hidden = new Set<string>();

  for (const rule of rules) {
    const results = rule.conditions.map((c) => {
      const val = (values[c.fieldId] ?? "").toLowerCase().trim();
      const target = (c.value ?? "").toLowerCase().trim();
      switch (c.operator) {
        case "equals":     return val === target;
        case "not_equals": return val !== target;
        case "contains":   return val.includes(target);
        case "not_empty":  return val !== "";
        case "is_empty":   return val === "";
        case "has_value":
          if (target === "si") return val !== "";
          if (target === "no") return val === "";
          return false;
        default:           return false;
      }
    });

    const met =
      rule.conditions.length === 0
        ? true
        : rule.matchType === "all"
        ? results.every(Boolean)
        : results.some(Boolean);

    if (met && rule.action === "hide") {
      rule.targetFieldIds.forEach((id) => hidden.add(id));
    } else if (!met && rule.action === "show") {
      rule.targetFieldIds.forEach((id) => hidden.add(id));
    }
  }

  // Segunda pasada: show explícito desbloqueado
  for (const rule of rules) {
    if (rule.action !== "show") continue;
    const results = rule.conditions.map((c) => {
      const val = (values[c.fieldId] ?? "").toLowerCase().trim();
      const target = (c.value ?? "").toLowerCase().trim();
      switch (c.operator) {
        case "equals":     return val === target;
        case "not_equals": return val !== target;
        case "contains":   return val.includes(target);
        case "not_empty":  return val !== "";
        case "is_empty":   return val === "";
        case "has_value":
          if (target === "si") return val !== "";
          if (target === "no") return val === "";
          return false;
        default:           return false;
      }
    });
    const met =
      rule.conditions.length === 0
        ? true
        : rule.matchType === "all"
        ? results.every(Boolean)
        : results.some(Boolean);
    if (met) rule.targetFieldIds.forEach((id) => hidden.delete(id));
  }

  return hidden;
}