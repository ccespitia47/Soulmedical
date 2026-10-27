import type { FormRule, WidgetInstance } from "./widget.types";
import type { EmailTemplate } from "./email-template.types";

export type ProjectItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
};

// ─── Versión de un formulario ─────────────────────────────────────────────────
export type FormVersion = {
  versionNumber: number;
  publishedAt: string;
  publishedBy: string;   // nombre del usuario que publicó
  widgets: WidgetInstance[];
  emailTemplate?: EmailTemplate;
  // Snapshot del array multi-template al momento de publicar la versión.
  emailTemplates?: EmailTemplate[];
  note?: string;         // descripción opcional del cambio
};

export type FormStatus = "draft" | "published";

export type FormItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Widgets del borrador (lo que ve el admin en el builder)
  widgets?: WidgetInstance[];
  // Reglas show/hide del formulario (persistidas con el schema en el backend)
  rules?: FormRule[];
  // LEGACY: configuración singular de email. Se mantiene para compat con
  // formularios creados antes de que `emailTemplates[]` existiera.
  emailTemplate?: EmailTemplate;
  // Múltiples configuraciones de email por formulario. Cada entry es
  // autónoma (sus propios destinatarios, cuerpo, asunto, PDF). Si está
  // presente y no vacío es la fuente de verdad; si no, se cae a
  // `emailTemplate` singular.
  emailTemplates?: EmailTemplate[];
  // Estado de publicación
  status: FormStatus;
  // Compartir público / confirmación
  isPublic?: boolean;
  sendConfirmationEmail?: boolean;
  /** Si true, antes de mostrar el form al público se pide email + OTP. */
  requiresEmailVerification?: boolean;
  // Versión publicada actual (lo que ven los usuarios)
  publishedWidgets?: WidgetInstance[];
  publishedEmailTemplate?: EmailTemplate;
  publishedEmailTemplates?: EmailTemplate[];
  // Historial de versiones publicadas
  versions?: FormVersion[];
  currentVersion?: number;
};

export type FolderItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  forms: FormItem[];
  createdAt: string;
  projectId: string;
};

// ─── Plantillas ───────────────────────────────────────────────────────────────
export type TemplateItem = {
  id: string;
  name: string;
  description?: string;
  icon: string;
  folderId: string;      // carpeta de plantillas donde está guardada
  widgets: WidgetInstance[];
  // Snapshot completo del formulario al momento de guardar la plantilla:
  // reglas show/hide y configuración de email (template, destinatarios,
  // Excel mapeado, plantilla PDF). Opcionales para retrocompatibilidad
  // con plantillas guardadas antes de este cambio.
  rules?: FormRule[];
  emailTemplate?: EmailTemplate;
  emailTemplates?: EmailTemplate[];
  createdAt: string;
  createdBy: string;     // nombre del usuario que la creó
};

export type TemplateFolderItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
};

export const PROJECT_COLORS = [
  { id: "teal",   value: "#00c2a8", label: "Verde"   },
  { id: "blue",   value: "#3b82f6", label: "Azul"    },
  { id: "purple", value: "#8b5cf6", label: "Morado"  },
  { id: "orange", value: "#f97316", label: "Naranja" },
  { id: "pink",   value: "#ec4899", label: "Rosa"    },
  { id: "indigo", value: "#6366f1", label: "Indigo"  },
];

// `id` es ahora una clave de icono SVG (ver components/common/Icon.tsx).
// Los proyectos creados antes guardan un emoji; EntityIcon los mapea.
export const PROJECT_ICONS = [
  { id: "building", label: "Empresa"      },
  { id: "wallet",   label: "Finanzas"     },
  { id: "chart",    label: "Reportes"     },
  { id: "health",   label: "Salud"        },
  { id: "users",    label: "Personas"     },
  { id: "settings", label: "Operaciones"  },
  { id: "package",  label: "Inventario"   },
  { id: "target",   label: "Objetivos"    },
];

export const FOLDER_COLORS = [
  { id: "teal",   value: "#00c2a8", label: "Verde"   },
  { id: "blue",   value: "#3b82f6", label: "Azul"    },
  { id: "purple", value: "#8b5cf6", label: "Morado"  },
  { id: "orange", value: "#f97316", label: "Naranja" },
  { id: "pink",   value: "#ec4899", label: "Rosa"    },
  { id: "gray",   value: "#6b7280", label: "Gris"    },
];

export const FOLDER_ICONS = [
  { id: "folder",    label: "Carpeta"      },
  { id: "clipboard", label: "Formulario"   },
  { id: "users",     label: "Personas"     },
  { id: "health",    label: "Salud"        },
  { id: "chart",     label: "Reportes"     },
  { id: "settings",  label: "Configuración"},
  { id: "target",    label: "Objetivos"    },
  { id: "fileText",  label: "Notas"        },
];