import { useEffect, useState } from "react";
import {
  getUserAssignmentsTreeApi,
  putUserAssignmentsTreeApi,
} from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";
import { useFolderStore } from "../../store/useFolderStore";
import AssignmentTree from "../common/assignmentTree/AssignmentTree";
import { useAssignmentState } from "../common/assignmentTree/useAssignmentState";

const ACCENT = "#00c2a8";

type AssignmentsTabProps = { userId: number };

export default function AssignmentsTab({ userId }: AssignmentsTabProps) {
  const { projects, loadProjects } = useProjectStore();
  const { folders, loadFolders } = useFolderStore();
  const state = useAssignmentState();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) Promise.all(projects.map((p) => loadFolders(p.id)));
  }, [projects.length]);

  // Cargar qué tiene asignado este usuario.
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getUserAssignmentsTreeApi(userId);
      const tree = res.data;
      if (tree) {
        state.setAssignedProjects(new Set(tree.projects));
        state.setAssignedFolders(new Set(tree.folders));
        state.setAssignedForms(new Set(tree.forms));
        state.setExcludedFolders(new Set(tree.excludedFolders));
        state.setExcludedForms(new Set(tree.excludedForms));
      }
      setLoading(false);
    };
    if (userId) load();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    await putUserAssignmentsTreeApi(userId, {
      projects: [...state.assignedProjects],
      folders: [...state.assignedFolders],
      forms: [...state.assignedForms],
      excludedFolders: [...state.excludedFolders],
      excludedForms: [...state.excludedForms],
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading)
    return (
      <div className="py-10 text-center text-[13px] text-gray-400">
        Cargando asignaciones...
      </div>
    );
  if (projects.length === 0)
    return (
      <div className="py-10 text-center text-[13px] text-gray-400">
        No hay proyectos creados aún.
      </div>
    );

  return (
    <div className="flex flex-col">
      <p className="mb-3.5 mt-0 text-xs leading-relaxed text-gray-500">
        Selecciona el nivel de acceso: <strong>proyecto completo</strong>,{" "}
        <strong>carpeta específica</strong> o{" "}
        <strong>formularios individuales</strong>.
      </p>

      <AssignmentTree
        projects={projects}
        folders={folders}
        assignedProjects={state.assignedProjects}
        assignedFolders={state.assignedFolders}
        assignedForms={state.assignedForms}
        excludedFolders={state.excludedFolders}
        excludedForms={state.excludedForms}
        expandedProjects={state.expandedProjects}
        onToggleExpand={state.toggleExpand}
        onToggleProject={state.toggleProject}
        onToggleFolder={(folderId, projectId) =>
          state.toggleFolder(folderId, projectId, folders)
        }
        onToggleForm={state.toggleForm}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg border-none px-5 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed"
        style={{ background: saved ? "#10b981" : ACCENT }}
      >
        {saving
          ? "Guardando..."
          : saved
          ? "✓ Guardado"
          : "💾 Guardar asignaciones"}
      </button>
    </div>
  );
}
