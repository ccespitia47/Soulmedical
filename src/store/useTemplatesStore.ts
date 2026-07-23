import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TemplateItem, TemplateFolderItem } from "../types/folder.types";
import type { FormRule, WidgetInstance } from "../types/widget.types";
import type { EmailTemplate } from "../types/email-template.types";
import { randomUUID } from "../utils/uuid";

interface TemplatesState {
  templates: TemplateItem[];
  templateFolders: TemplateFolderItem[];

  // ── Carpetas de plantillas ───────────────────────────────────────────────
  addTemplateFolder: (name: string, color: string, icon: string) => void;
  updateTemplateFolder: (id: string, changes: Partial<TemplateFolderItem>) => void;
  deleteTemplateFolder: (id: string) => void;

  // ── Plantillas ───────────────────────────────────────────────────────────
  addTemplate: (data: {
    name: string;
    description?: string;
    icon: string;
    folderId: string;
    widgets: WidgetInstance[];
    rules?: FormRule[];
    emailTemplate?: EmailTemplate;
    createdBy: string;
  }) => void;
  updateTemplate: (id: string, changes: Partial<TemplateItem>) => void;
  deleteTemplate: (id: string) => void;
  moveTemplate: (id: string, newFolderId: string) => void;
  getTemplatesByFolder: (folderId: string) => TemplateItem[];
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],
      templateFolders: [],

      addTemplateFolder: (name, color, icon) =>
        set((state) => ({
          templateFolders: [
            ...state.templateFolders,
            {
              id: randomUUID(),
              name, color, icon,
              createdAt: new Date().toLocaleDateString("es-CO"),
            },
          ],
        })),

      updateTemplateFolder: (id, changes) =>
        set((state) => ({
          templateFolders: state.templateFolders.map((f) =>
            f.id === id ? { ...f, ...changes } : f
          ),
        })),

      deleteTemplateFolder: (id) =>
        set((state) => ({
          templateFolders: state.templateFolders.filter((f) => f.id !== id),
          // Mover plantillas huérfanas a sin carpeta
          templates: state.templates.map((t) =>
            t.folderId === id ? { ...t, folderId: "" } : t
          ),
        })),

      addTemplate: (data) =>
        set((state) => ({
          templates: [
            ...state.templates,
            {
              id: randomUUID(),
              name: data.name,
              description: data.description ?? "",
              icon: data.icon,
              folderId: data.folderId,
              widgets: data.widgets,
              rules: data.rules ?? [],
              emailTemplate: data.emailTemplate,
              createdAt: new Date().toLocaleDateString("es-CO"),
              createdBy: data.createdBy,
            },
          ],
        })),

      updateTemplate: (id, changes) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...changes } : t
          ),
        })),

      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),

      moveTemplate: (id, newFolderId) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, folderId: newFolderId } : t
          ),
        })),

      getTemplatesByFolder: (folderId) =>
        get().templates.filter((t) => t.folderId === folderId),
    }),
    { name: "soulforms-templates" }
  )
);