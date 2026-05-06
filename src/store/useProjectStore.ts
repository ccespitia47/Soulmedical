import { create } from "zustand";
import type { ProjectItem } from "../types/folder.types";
import {
  getProjects,
  createProject,
  updateProjectApi,
  deleteProjectApi,
  type ProjectData,
} from "../services/api";

function mapProject(p: ProjectData): ProjectItem {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    createdAt: new Date(p.createdAt).toLocaleDateString("es-CO"),
  };
}

interface ProjectState {
  projects: ProjectItem[];
  selectedProjectId: string | null;
  loading: boolean;

  loadProjects: () => Promise<void>;
  addProject: (name: string, color: string, icon: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, changes: Partial<ProjectItem>) => Promise<void>;
  selectProject: (id: string | null) => void;
  duplicateProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const { data, error } = await getProjects();
    if (error) console.error('[ProjectStore] loadProjects error:', error);
    if (data) {
      set({ projects: data.map(mapProject) });
    }
    set({ loading: false });
  },

  addProject: async (name, color, icon) => {
    const { data, error } = await createProject({ name, color, icon });
    if (error) { console.error('[ProjectStore] addProject error:', error); alert(`Error al crear proyecto: ${error}`); return; }
    if (data) {
      const project = mapProject(data);
      set((state) => ({
        projects: [...state.projects, project],
        selectedProjectId: project.id,
      }));
    }
  },

  deleteProject: async (id) => {
    await deleteProjectApi(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },

  updateProject: async (id, changes) => {
    const { data } = await updateProjectApi(id, changes);
    if (data) {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? mapProject(data) : p)),
      }));
    }
  },

  selectProject: (id) => set({ selectedProjectId: id }),

  duplicateProject: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const { data } = await createProject({
      name: `${project.name} (copia)`,
      color: project.color,
      icon: project.icon,
    });
    if (data) {
      set((state) => ({
        projects: [...state.projects, mapProject(data)],
      }));
    }
  },
}));
