import { useEffect, useState } from "react";
import {
  getProjectAssignmentsApi,
  assignProjectToUserApi,
  unassignProjectFromUserApi,
  getFormAssignmentsApi,
  assignFormToUserApi,
  unassignFormFromUserApi,
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

  // Cargar qué tiene asignado este usuario (por proyecto y por form).
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const projRes = await Promise.all(
        projects.map((p) => getProjectAssignmentsApi(p.id)),
      );
      const projIds = new Set<string>();
      projRes.forEach((r, i) => {
        if (r.data?.some((a) => a.userId === userId)) projIds.add(projects[i].id);
      });
      state.setAssignedProjects(projIds);

      const formIds = new Set<string>();
      const allForms = folders.flatMap((f) =>
        f.forms.map((fm) => ({ formId: fm.id, folderId: f.id })),
      );
      if (allForms.length > 0) {
        const formRes = await Promise.all(
          allForms.map((f) => getFormAssignmentsApi(f.formId)),
        );
        formRes.forEach((r, i) => {
          if (r.data?.some((a) => a.userId === userId))
            formIds.add(allForms[i].formId);
        });
      }
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

    if (projects.length > 0 && folders.length > 0) load();
    else if (projects.length > 0) setLoading(false);
  }, [userId, projects.length, folders.length]);

  const handleSave = async () => {
    setSaving(true);
    // Sincronizar projects
    for (const project of projects) {
      const res = await getProjectAssignmentsApi(project.id);
      const currently = res.data?.some((a) => a.userId === userId) ?? false;
      const should = state.assignedProjects.has(project.id);
      if (should && !currently) await assignProjectToUserApi(project.id, userId);
      else if (!should && currently)
        await unassignProjectFromUserApi(project.id, userId);
    }
    // Sincronizar forms (heredando proyecto/carpeta)
    const allForms = folders.flatMap((f) =>
      f.forms.map((fm) => ({
        formId: fm.id,
        folderId: f.id,
        projectId: f.projectId,
      })),
    );
    for (const { formId, projectId } of allForms) {
      const res = await getFormAssignmentsApi(formId);
      const currently = res.data?.some((a) => a.userId === userId) ?? false;
      const folder = folders.find((f) => f.forms.some((fm) => fm.id === formId));
      const should =
        state.assignedProjects.has(projectId) ||
        (folder ? state.assignedFolders.has(folder.id) : false) ||
        state.assignedForms.has(formId);
      if (should && !currently) await assignFormToUserApi(formId, userId);
      else if (!should && currently)
        await unassignFormFromUserApi(formId, userId);
    }
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
