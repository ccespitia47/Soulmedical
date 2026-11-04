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
  | "quiz_score";

export type SubformField = {
  id: string;
  type: SubformFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  // ── Configs específicas de widgets portados ──
  /** URL (para image/video) o contenido HTML (htmlblock). */
  url?: string;
  htmlContent?: string;
  /** price: prefijo visual (ej. "$", "COP"). */
  pricePrefix?: string;
  /** file: filtro MIME (ej. "application/pdf,image/*"). */
  accept?: string;
  /** calc: fórmula simple con ids de campos del mismo subform. Ej. "a+b*2". */
  formula?: string;
  /** quiz_question: índice de la opción correcta (0-based). */
  correctOptionIndex?: number;
  /** quiz_question: puntos que vale la opción correcta. */
  points?: number;
  /** radio: orientación de las opciones (default true = vertical). */
  verticalAlign?: boolean;
  /** radio / text / price / select: persiste la última entrada en localStorage. */
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

  // ── price ────────────────────────────────────────────────────────────
  /** price: código de moneda (COP, USD, EUR, MXN…). */
  currency?: string;
  /** price: separador decimal ("comma" o "dot", match con el main). */
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

  // ── calc ─────────────────────────────────────────────────────────────
  /** calc: operador aplicado a los campos referenciados. */
  calcOperator?: "sum" | "subtract" | "multiply" | "divide" | "average" | "min" | "max" | "count";
  /** calc: valor inicial a sumar al resultado. */
  initialValue?: number;
  /** calc: ignorar valores no numéricos (default true). */
  ignoreInvalid?: boolean;
  /** calc: mostrar como precio con el prefijo `pricePrefix`. */
  isPrice?: boolean;

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
  /** idDocument: formatea con separador de miles al tipear. */
  thousandsSeparator?: boolean;

  // ── image (view-only — URL externa o upload a GridFS) ────────────────
  /** image: fileId en GridFS cuando la imagen fue subida (no URL externa). */
  imageFileId?: string;
  /** image: ancho máximo en px (null = sin límite). */
  maxWidth?: number;
  /** image: alto máximo en px. */
  maxHeight?: number;
  /** image: abre modal con la imagen ampliada al click. */
  clickable?: boolean;

  // ── video ────────────────────────────────────────────────────────────
  /** video: duración máxima permitida en segundos. */
  maxDurationSecs?: number;

  // ── header ───────────────────────────────────────────────────────────
  /** header: texto del encabezado (separado de `label`). */
  headerText?: string;
  /** header: tamaño visual (small / medium / large). */
  headerSize?: "small" | "medium" | "large";
  /** header: mostrar línea divisoria debajo. */
  showDivider?: boolean;

  // ── barcode ──────────────────────────────────────────────────────────
  /** barcode: habilita botón de "escanear" (preview, sin cámara real). */
  scannerEnabled?: boolean;

  // ── idscanner ────────────────────────────────────────────────────────
  /** idscanner: qué campos extraer (nombre, numero, fechaNacimiento, …). */
  idscannerFields?: string[];
  /** idscanner: permitir edición manual del resultado. */
  allowManual?: boolean;
  /** idscanner: tipo de documento (auto / cc / ce / ti / passport). */
  documentType?: "auto" | "cc" | "ce" | "ti" | "passport";
};

export type SubformEntry = Record<string, string>;

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