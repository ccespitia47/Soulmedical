import { create } from "zustand";
import type { FolderItem, FormItem } from "../types/folder.types";
import type { FormRule, WidgetInstance } from "../types/widget.types";
import type { EmailTemplate } from "../types/email-template.types";
import {
  getFoldersByProject,
  createFolder,
  updateFolderApi,
  deleteFolderApi,
  getFormsByFolder,
  createFormApi,
  updateFormApi,
  deleteFormApi,
  type FolderData,
  type FormApiData,
} from "../services/api";

function mapForm(f: FormApiData): FormItem {
  return {
    id: f.id,
    name: f.name,
    createdAt: new Date(f.createdAt).toLocaleDateString("es-CO"),
    updatedAt: new Date(f.updatedAt).toLocaleDateString("es-CO"),
    widgets: (f.schema?.widgets ?? []) as WidgetInstance[],
    rules: (f.schema?.rules ?? []) as FormRule[],
    emailTemplate: (f.emailTemplate ?? undefined) as EmailTemplate | undefined,
    isPublic: f.isPublic ?? false,
    sendConfirmationEmail: f.sendConfirmationEmail ?? true,
    requiresEmailVerification: f.requiresEmailVerification ?? false,
    status: "published",
  };
}

function mapFolder(f: FolderData, forms: FormItem[] = []): FolderItem {
  return {
    id: f.id,
    name: f.name,
    color: f.color,
    icon: f.icon,
    projectId: f.projectId,
    createdAt: new Date(f.createdAt).toLocaleDateString("es-CO"),
    forms,
  };
}

interface FolderState {
  folders: FolderItem[];
  selectedFolderId: string | null;
  loading: boolean;

  loadFolders: (projectId: string) => Promise<void>;
  loadAllFolders: (projectIds: string[]) => Promise<void>;
  addFolder: (name: string, color: string, icon: string, projectId: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  updateFolder: (id: string, changes: Partial<FolderItem>) => Promise<void>;
  selectFolder: (id: string | null) => void;
  duplicateFolder: (id: string) => Promise<void>;

  addForm: (folderId: string, name: string) => Promise<void>;
  /** Crea un form atómicamente con todo el snapshot (widgets + rules + emailTemplate) y devuelve su id. */
  addFormFromTemplate: (
    folderId: string,
    name: string,
    widgets: WidgetInstance[],
    rules?: FormRule[],
    emailTemplate?: EmailTemplate,
  ) => Promise<string | null>;
  deleteForm: (folderId: string, formId: string) => Promise<void>;
  renameForm: (folderId: string, formId: string, name: string) => Promise<void>;
  duplicateForm: (folderId: string, formId: string) => Promise<void>;
  saveFormWidgets: (folderId: string, formId: string, widgets: WidgetInstance[]) => Promise<void>;
  saveFormRules: (folderId: string, formId: string, rules: FormRule[]) => Promise<void>;
  updateFormEmailTemplate: (folderId: string, formId: string, emailTemplate: EmailTemplate) => Promise<void>;
  /** Actualiza solo en memoria los flags de compartir; el PATCH al backend lo hace ShareFormModal. */
  setFormShareFlags: (
    folderId: string,
    formId: string,
    isPublic: boolean,
    sendConfirmationEmail: boolean,
    requiresEmailVerification: boolean,
  ) => void;
  publishForm: (folderId: string, formId: string, publishedBy: string, note?: string) => void;
  revertToVersion: (folderId: string, formId: string, versionNumber: number) => void;
}

export const useFolderStore = create<FolderState>()((set, get) => ({
  folders: [],
  selectedFolderId: null,
  loading: false,

  loadFolders: async (projectId) => {
    set({ loading: true });
    const { data: foldersData, error } = await getFoldersByProject(projectId);
    if (error) console.error('[FolderStore] loadFolders error:', error);
    if (!foldersData) { set({ loading: false }); return; }

    // Cargar forms de todas las carpetas en paralelo
    const foldersWithForms = await Promise.all(
      foldersData.map(async (f) => {
        const { data: formsData } = await getFormsByFolder(f.id);
        return mapFolder(f, (formsData ?? []).map(mapForm));
      })
    );

    // Merge: conservar carpetas de otros proyectos y reemplazar solo las del actual.
    // Sin esto, Promise.all(projects.map(p => loadFolders(p.id))) deja solo el último ganador.
    set((state) => ({
      folders: [
        ...state.folders.filter((f) => f.projectId !== projectId),
        ...foldersWithForms,
      ],
      loading: false,
    }));
  },

  loadAllFolders: async (projectIds) => {
    await Promise.all(projectIds.map((id) => get().loadFolders(id)));
  },

  addFolder: async (name, color, icon, projectId) => {
    const { data, error } = await createFolder({ name, color, icon, projectId });
    if (error) { console.error('[FolderStore] addFolder:', error); alert(`Error al crear carpeta: ${error}`); return; }
    if (data) {
      set((state) => ({
        folders: [...state.folders, mapFolder(data, [])],
      }));
    }
  },

  renameFolder: async (id, name) => {
    const { data } = await updateFolderApi(id, { name });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === id ? { ...f, name: data.name } : f
        ),
      }));
    }
  },

  deleteFolder: async (id) => {
    await deleteFolderApi(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
    }));
  },

  updateFolder: async (id, changes) => {
    const { data } = await updateFolderApi(id, changes);
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === id ? { ...f, ...changes } : f
        ),
      }));
    }
  },

  selectFolder: (id) => set({ selectedFolderId: id }),

  duplicateFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;

    const { data: newFolder } = await createFolder({
      name: `${folder.name} (copia)`,
      color: folder.color,
      icon: folder.icon,
      projectId: folder.projectId,
    });
    if (!newFolder) return;

    // Crear cada form de la carpeta original en la nueva carpeta
    const newForms = await Promise.all(
      folder.forms.map(async (form) => {
        const { data } = await createFormApi({
          name: form.name,
          folderId: newFolder.id,
          schema: { widgets: form.widgets ?? [] },
          emailTemplate: form.emailTemplate as object | undefined,
        });
        return data ? mapForm(data) : null;
      })
    );

    set((state) => ({
      folders: [
        ...state.folders,
        mapFolder(newFolder, newForms.filter(Boolean) as FormItem[]),
      ],
    }));
  },

  addForm: async (folderId, name) => {
    const { data, error } = await createFormApi({ name, folderId });
    if (error) { console.error('[FolderStore] addForm:', error); alert(`Error al crear formulario: ${error}`); return; }
    if (data) {
      const form = mapForm(data);
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId ? { ...f, forms: [...f.forms, form] } : f
        ),
      }));
    }
  },

  // Crea un formulario en UNA sola llamada al backend, mandando widgets,
  // rules y emailTemplate juntos en el schema. Evita el patrón frágil de
  // "addForm + setTimeout + saveFormWidgets" que dependía de adivinar
  // cuánto tarda el API en responder.
  addFormFromTemplate: async (folderId, name, widgets, rules, emailTemplate) => {
    const { data, error } = await createFormApi({
      name,
      folderId,
      schema: { widgets, rules: rules ?? [] },
      emailTemplate: emailTemplate as object | undefined,
    });
    if (error) {
      console.error('[FolderStore] addFormFromTemplate:', error);
      alert(`Error al crear formulario desde plantilla: ${error}`);
      return null;
    }
    if (!data) return null;
    const form = mapForm(data);
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === folderId ? { ...f, forms: [...f.forms, form] } : f,
      ),
    }));
    return form.id;
  },

  deleteForm: async (folderId, formId) => {
    await deleteFormApi(formId);
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === folderId
          ? { ...f, forms: f.forms.filter((fm) => fm.id !== formId) }
          : f
      ),
    }));
  },

  renameForm: async (folderId, formId, name) => {
    const { data } = await updateFormApi(formId, { name });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                forms: f.forms.map((fm) =>
                  fm.id === formId
                    ? { ...fm, name, updatedAt: new Date().toLocaleDateString("es-CO") }
                    : fm
                ),
              }
            : f
        ),
      }));
    }
  },

  duplicateForm: async (folderId, formId) => {
    const folder = get().folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (!form) return;

    const { data } = await createFormApi({
      name: `${form.name} (copia)`,
      folderId,
      schema: { widgets: form.widgets ?? [], rules: form.rules ?? [] },
      emailTemplate: form.emailTemplate as object | undefined,
    });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? { ...f, forms: [...f.forms, mapForm(data)] }
            : f
        ),
      }));
    }
  },

  saveFormWidgets: async (folderId, formId, widgets) => {
    // Preservar rules ya guardadas en el schema para no perderlas al guardar
    // solo widgets desde el builder.
    const currentForm = get()
      .folders.find((f) => f.id === folderId)
      ?.forms.find((fm) => fm.id === formId);
    const rules = currentForm?.rules ?? [];
    const { data } = await updateFormApi(formId, { schema: { widgets, rules } });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                forms: f.forms.map((fm) =>
                  fm.id === formId
                    ? { ...fm, widgets, updatedAt: new Date().toLocaleDateString("es-CO") }
                    : fm
                ),
              }
            : f
        ),
      }));
    }
  },

  saveFormRules: async (folderId, formId, rules) => {
    // Preservar widgets ya guardados para no perderlos al guardar solo rules.
    const currentForm = get()
      .folders.find((f) => f.id === folderId)
      ?.forms.find((fm) => fm.id === formId);
    const widgets = currentForm?.widgets ?? [];
    const { data } = await updateFormApi(formId, { schema: { widgets, rules } });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                forms: f.forms.map((fm) =>
                  fm.id === formId
                    ? { ...fm, rules, updatedAt: new Date().toLocaleDateString("es-CO") }
                    : fm
                ),
              }
            : f
        ),
      }));
    }
  },

  setFormShareFlags: (
    folderId,
    formId,
    isPublic,
    sendConfirmationEmail,
    requiresEmailVerification,
  ) => {
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === folderId
          ? {
              ...f,
              forms: f.forms.map((fm) =>
                fm.id === formId
                  ? {
                      ...fm,
                      isPublic,
                      sendConfirmationEmail,
                      requiresEmailVerification,
                    }
                  : fm,
              ),
            }
          : f,
      ),
    }));
  },

  updateFormEmailTemplate: async (folderId, formId, emailTemplate) => {
    const { data } = await updateFormApi(formId, { emailTemplate: emailTemplate as object });
    if (data) {
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === folderId
            ? {
                ...f,
                forms: f.forms.map((fm) =>
                  fm.id === formId ? { ...fm, emailTemplate } : fm
                ),
              }
            : f
        ),
      }));
    }
  },

  // Operaciones de versionado locales (TODO: persistir en backend).
  publishForm: (folderId, formId, publishedBy, note) => {
    set((state) => ({
      folders: state.folders.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          forms: f.forms.map((fm) => {
            if (fm.id !== formId) return fm;
            const versions = fm.versions ?? [];
            const nextNumber = (fm.currentVersion ?? 0) + 1;
            const newVersion = {
              versionNumber: nextNumber,
              publishedAt: new Date().toLocaleString("es-CO"),
              publishedBy,
              widgets: fm.widgets ?? [],
              emailTemplate: fm.emailTemplate,
              note,
            };
            return {
              ...fm,
              status: "published" as const,
              publishedWidgets: fm.widgets ?? [],
              publishedEmailTemplate: fm.emailTemplate,
              versions: [...versions, newVersion],
              currentVersion: nextNumber,
            };
          }),
        };
      }),
    }));
  },

  revertToVersion: (folderId, formId, versionNumber) => {
    set((state) => ({
      folders: state.folders.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          forms: f.forms.map((fm) => {
            if (fm.id !== formId) return fm;
            const version = fm.versions?.find((v) => v.versionNumber === versionNumber);
            if (!version) return fm;
            return {
              ...fm,
              widgets: version.widgets,
              emailTemplate: version.emailTemplate,
              publishedWidgets: version.widgets,
              publishedEmailTemplate: version.emailTemplate,
              currentVersion: versionNumber,
            };
          }),
        };
      }),
    }));
  },
}));
