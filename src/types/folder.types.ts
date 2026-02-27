import type { WidgetInstance } from "./widget.types";

export type ProjectItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
};

export type FormItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  widgets?: WidgetInstance[];
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

export const PROJECT_COLORS = [
  { id: "teal",   value: "#00c2a8", label: "Verde"   },
  { id: "blue",   value: "#3b82f6", label: "Azul"    },
  { id: "purple", value: "#8b5cf6", label: "Morado"  },
  { id: "orange", value: "#f97316", label: "Naranja" },
  { id: "pink",   value: "#ec4899", label: "Rosa"    },
  { id: "indigo", value: "#6366f1", label: "Indigo"  },
];

export const PROJECT_ICONS = [
  { id: "🏢", label: "Empresa"      },
  { id: "💰", label: "Finanzas"     },
  { id: "📊", label: "Reportes"     },
  { id: "🏥", label: "Salud"        },
  { id: "👥", label: "Personas"     },
  { id: "⚙️", label: "Operaciones"  },
  { id: "📦", label: "Inventario"   },
  { id: "🎯", label: "Objetivos"    },
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
  { id: "📁", label: "Carpeta"     },
  { id: "📋", label: "Formulario"  },
  { id: "👥", label: "Personas"    },
  { id: "🏥", label: "Salud"       },
  { id: "📊", label: "Reportes"    },
  { id: "⚙️", label: "Configuración"},
  { id: "🎯", label: "Objetivos"   },
  { id: "📝", label: "Notas"       },
];