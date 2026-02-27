import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FolderItem } from "../types/folder.types";
import type { WidgetInstance } from "../types/widget.types";


interface FolderState {
  folders: FolderItem[];
  selectedFolderId: string | null;

  addFolder: (name: string, color: string, icon: string, projectId: string) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  updateFolder: (id: string, changes: Partial<FolderItem>) => void;
  selectFolder: (id: string | null) => void;
  duplicateFolder: (id: string) => void;
  
  addForm: (folderId: string, name: string) => void;
  deleteForm: (folderId: string, formId: string) => void;
  renameForm: (folderId: string, formId: string, name: string) => void;
  duplicateForm: (folderId: string, formId: string) => void;
  saveFormWidgets: (folderId: string, formId: string, widgets: WidgetInstance[]) => void;
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set) => ({
      folders: [],
      selectedFolderId: null,

      addFolder: (name, color, icon, projectId) =>
        set((state) => ({
          folders: [
            ...state.folders,
            {
              id: crypto.randomUUID(),
              name,
              color,
              icon,
              forms: [],
              createdAt: new Date().toLocaleDateString("es-CO"),
              projectId,
            },
          ],
        })),

      renameFolder: (id, name) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        })),

      deleteFolder: (id) =>
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          selectedFolderId:
            state.selectedFolderId === id ? null : state.selectedFolderId,
        })),

      updateFolder: (id, changes) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...changes } : f
          ),
        })),

      selectFolder: (id) => set({ selectedFolderId: id }),

      duplicateFolder: (id) =>
        set((state) => {
          const folder = state.folders.find((f) => f.id === id);
          if (!folder) return state;

          const duplicate: FolderItem = {
            ...folder,
            id: crypto.randomUUID(),
            name: `${folder.name} (copia)`,
            createdAt: new Date().toLocaleDateString("es-CO"),
            forms: folder.forms.map((form) => ({
              ...form,
              id: crypto.randomUUID(),
            })),
          };

          return { folders: [...state.folders, duplicate] };
        }),

      addForm: (folderId, name) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? {
                  ...f,
                  forms: [
                    ...f.forms,
                    {
                      id: crypto.randomUUID(),
                      name,
                      createdAt: new Date().toLocaleDateString("es-CO"),
                      updatedAt: new Date().toLocaleDateString("es-CO"),
                    },
                  ],
                }
              : f
          ),
        })),

      deleteForm: (folderId, formId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? { ...f, forms: f.forms.filter((fm) => fm.id !== formId) }
              : f
          ),
        })),

      renameForm: (folderId, formId, name) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? {
                  ...f,
                  forms: f.forms.map((fm) =>
                    fm.id === formId
                      ? {
                          ...fm,
                          name,
                          updatedAt: new Date().toLocaleDateString("es-CO"),
                        }
                      : fm
                  ),
                }
              : f
          ),
        })),

      duplicateForm: (folderId, formId) =>
        set((state) => ({
          folders: state.folders.map((f) => {
            if (f.id !== folderId) return f;
            
            const form = f.forms.find((fm) => fm.id === formId);
            if (!form) return f;

            const duplicate = {
              ...form,
              id: crypto.randomUUID(),
              name: `${form.name} (copia)`,
              createdAt: new Date().toLocaleDateString("es-CO"),
              updatedAt: new Date().toLocaleDateString("es-CO"),
            };

            return { ...f, forms: [...f.forms, duplicate] };
          }),
        })),

      saveFormWidgets: (folderId, formId, widgets) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? {
                  ...f,
                  forms: f.forms.map((fm) =>
                    fm.id === formId
                      ? {
                          ...fm,
                          widgets,
                          updatedAt: new Date().toLocaleDateString("es-CO"),
                        }
                      : fm
                  ),
                }
              : f
          ),
        })),
    }),
    {
      name: "soulforms-folders",
    }
  )
);