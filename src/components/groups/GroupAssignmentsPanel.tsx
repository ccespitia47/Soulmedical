import { useEffect, useState } from "react";
import {
  getGroupAssignmentsApi,
  assignProjectToGroupApi,
  unassignProjectFromGroupApi,
  assignFormToGroupApi,
  unassignFormFromGroupApi,
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
      const res = await getGroupAssignmentsApi(groupId);
      const data = res.data ?? [];
      const projIds = new Set(
        data.filter((a) => a.projectId && !a.formId).map((a) => a.projectId!),
      );
      const formIds = new Set(data.filter((a) => a.formId).map((a) => a.formId!));
      state.setAssignedProjects(projIds);
      state.setAssignedForms(formIds);
      const folderIds = new Set<string>();
      folders.forEach((folder) => {
        if (!projIds.has(folder.projectId)) {
          if (folder.forms.some((fm) => formIds.has(fm.id)))
            folderIds.add(folder.id);
        }
      });
      state.setAssignedFolders(folderIds);
      setLoading(false);
    };
    if (folders.length > 0) load();
    else if (projects.length > 0 && folders.length === 0) setLoading(false);
  }, [groupId, folders.length]);

  const handleSave = async () => {
    setSaving(true);
    const res = await getGroupAssignmentsApi(groupId);
    const current = res.data ?? [];
    const currentProjects = new Set(
      current.filter((a) => a.projectId && !a.formId).map((a) => a.projectId!),
    );
    const currentForms = new Set(
      current.filter((a) => a.formId).map((a) => a.formId!),
    );

    for (const p of projects) {
      if (state.assignedProjects.has(p.id) && !currentProjects.has(p.id))
        await assignProjectToGroupApi(groupId, p.id);
      if (!state.assignedProjects.has(p.id) && currentProjects.has(p.id))
        await unassignProjectFromGroupApi(groupId, p.id);
    }

    const allForms = folders.flatMap((f) =>
      f.forms.map((fm) => ({
        formId: fm.id,
        folderId: f.id,
        projectId: f.projectId,
      })),
    );
    for (const { formId, folderId, projectId } of allForms) {
      const folder = folders.find((f) => f.id === folderId);
      const should =
        state.assignedProjects.has(projectId) ||
        (folder ? state.assignedFolders.has(folder.id) : false) ||
        state.assignedForms.has(formId);
      if (should && !currentForms.has(formId))
        await assignFormToGroupApi(groupId, formId);
      if (!should && currentForms.has(formId))
        await unassignFormFromGroupApi(groupId, formId);
    }

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
