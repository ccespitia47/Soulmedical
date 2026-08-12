import { useEffect, useState } from "react";
import {
  getGroupAssignmentsTreeApi,
  putGroupAssignmentsTreeApi,
} from "../../services/api";
import { useProjectStore } from "../../store/useProjectStore";
import { useFolderStore } from "../../store/useFolderStore";
import AssignmentTree from "../common/assignmentTree/AssignmentTree";
import { useAssignmentState } from "../common/assignmentTree/useAssignmentState";

const ACCENT = "#00c2a8";

type GroupAssignmentsPanelProps = { groupId: string };

export default function GroupAssignmentsPanel({ groupId }: GroupAssignmentsPanelProps) {
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getGroupAssignmentsTreeApi(groupId);
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
    if (groupId) load();
  }, [groupId]);

  const handleSave = async () => {
    setSaving(true);
    await putGroupAssignmentsTreeApi(groupId, {
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
      <div className="py-7 text-center text-[13px] text-gray-400">
        Cargando...
      </div>
    );

  return (
    <div>
      <p className="m-0 mb-3 text-xs text-gray-500">
        Asigna proyectos completos, carpetas específicas o formularios
        individuales.
      </p>

      {projects.length === 0 ? (
        <div className="mb-3.5 rounded-[10px] border border-slate-200 p-5 text-center text-xs text-gray-400">
          No hay proyectos
        </div>
      ) : (
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
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="cursor-pointer rounded-lg border-none px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
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
