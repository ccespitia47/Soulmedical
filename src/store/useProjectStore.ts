import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProjectItem } from "../types/folder.types";

interface ProjectState {
  projects: ProjectItem[];
  selectedProjectId: string | null;

  addProject: (name: string, color: string, icon: string) => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, changes: Partial<ProjectItem>) => void;
  selectProject: (id: string | null) => void;
  duplicateProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      selectedProjectId: null,

      addProject: (name, color, icon) =>
        set((state) => {
          const newProject: ProjectItem = {
            id: crypto.randomUUID(),
            name,
            color,
            icon,
            createdAt: new Date().toLocaleDateString("es-CO"),
          };
          return {
            projects: [...state.projects, newProject],
            selectedProjectId: newProject.id,
          };
        }),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          selectedProjectId:
            state.selectedProjectId === id ? null : state.selectedProjectId,
        })),

      updateProject: (id, changes) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...changes } : p
          ),
        })),

      selectProject: (id) => set({ selectedProjectId: id }),

      duplicateProject: (id) =>
        set((state) => {
          const project = state.projects.find((p) => p.id === id);
          if (!project) return state;

          const duplicate: ProjectItem = {
            ...project,
            id: crypto.randomUUID(),
            name: `${project.name} (copia)`,
            createdAt: new Date().toLocaleDateString("es-CO"),
          };

          return { projects: [...state.projects, duplicate] };
        }),
    }),
    { name: "soulforms-projects" }
  )
);
