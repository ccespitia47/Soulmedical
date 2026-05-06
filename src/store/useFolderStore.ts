import { create } from "zustand";
import type { FolderItem, FormItem } from "../types/folder.types";
import type { WidgetInstance } from "../types/widget.types";
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
    emailTemplate: (f.emailTemplate ?? undefined) as EmailTemplate | undefined,
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
  addFolder: (name: string, color: string, icon: string, projectId: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  updateFolder: (id: string, changes: Partial<FolderItem>) => Promise<void>;
  selectFolder: (id: string | null) => void;
  duplicateFolder: (id: string) => Promise<void>;

  addForm: (folderId: string, name: string) => Promise<void>;
  deleteForm: (folderId: string, formId: string) => Promise<void>;
  renameForm: (folderId: string, formId: string, name: string) => Promise<void>;
  duplicateForm: (folderId: string, formId: string) => Promise<void>;
  saveFormWidgets: (folderId: string, formId: string, widgets: WidgetInstance[]) => Promise<void>;
  updateFormEmailTemplate: (folderId: string, formId: string, emailTemplate: EmailTemplate) => Promise<void>;
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

    set({ folders: foldersWithForms, loading: false });
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
      schema: { widgets: form.widgets ?? [] },
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
    const { data } = await updateFormApi(formId, { schema: { widgets } });
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
}));
