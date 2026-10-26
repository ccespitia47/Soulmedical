import type { SubformFieldType, SubformRuleOperator } from "../subform.types";

// Mapa de tipo de campo → clave del Icon SVG del sistema (ver src/components/common/Icon.tsx).
export const SUBFORM_FIELD_ICONS: Record<SubformFieldType, string> = {
  text:          "fileText",
  textarea:      "textLines",
  number:        "hash",
  price:         "price",
  email:         "mail",
  phone:         "phone",
  date:          "calendar",
  time:          "clock",
  select:        "list",
  checkbox:      "checkSquare",
  radio:         "radio",
  search:        "search",
  signature:     "edit",
  photo:         "camera",
  file:          "file",
  barcode:       "grid",
  idscanner:     "idCard",
  idDocument:    "idCard",
  image:         "image",
  video:         "video",
  header:        "type",
  htmlblock:     "code",
  calc:          "calc",
  quiz_question: "help",
  quiz_score:    "award",
};

export const FIELD_TYPES: { value: SubformFieldType; label: string }[] = [
  { value: "text",          label: "Texto corto"         },
  { value: "textarea",      label: "Área de texto"       },
  { value: "number",        label: "Número"              },
  { value: "price",         label: "Precio"              },
  { value: "email",         label: "Email"               },
  { value: "phone",         label: "Teléfono"            },
  { value: "date",          label: "Fecha"               },
  { value: "time",          label: "Hora"                },
  { value: "select",        label: "Desplegable"         },
  { value: "checkbox",      label: "Casilla"             },
  { value: "radio",         label: "Opción única"        },
  { value: "search",        label: "Búsqueda"            },
  { value: "signature",     label: "Firma"               },
  { value: "photo",         label: "Foto"                },
  { value: "file",          label: "Archivo adjunto"     },
  { value: "barcode",       label: "Código de barras"    },
  { value: "idscanner",     label: "Escáner cédula"      },
  { value: "idDocument",    label: "Documento ID"        },
  { value: "image",         label: "Imagen"              },
  { value: "video",         label: "Video"               },
  { value: "header",        label: "Encabezado"          },
  { value: "htmlblock",     label: "Bloque HTML"         },
  { value: "calc",          label: "Cálculo"             },
  { value: "quiz_question", label: "Pregunta de quiz"    },
  { value: "quiz_score",    label: "Nota final (quiz)"   },
];

export const OPERATOR_LABELS: Record<SubformRuleOperator, string> = {
  equals:    "es igual a",
  not_equals:"no es igual a",
  contains:  "contiene",
  not_empty: "no está vacío",
  is_empty:  "está vacío",
  has_value: "tiene valor",
};

// `has_value` también pide valor, pero con un select Si/No en vez de
// texto/opciones del campo — ver SubformRuleCard para la rama de UI.
export const OPERATORS_WITH_VALUE: SubformRuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "has_value",
];

export const HAS_VALUE_OPTIONS: { value: string; label: string }[] = [
  { value: "si", label: "Si" },
  { value: "no", label: "No" },
];

export const FIELDS_WITH_OPTIONS: SubformFieldType[] = [
  "select",
  "radio",
  "checkbox",
  "search",
  "quiz_question",
];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Tailwind classes compartidas
export const SUBFORM_INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 outline-none focus:border-[#00c2a8]";

export const SUBFORM_LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-gray-500";
