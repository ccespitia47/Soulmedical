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

const ACCENT = "#00c2a8";

type AssignmentsTabProps = { userId: number };

export default function AssignmentsTab({ userId }: AssignmentsTabProps) {
  const { projects, loadProjects } = useProjectStore();
  const { folders, loadFolders } = useFolderStore();

  const [assignedProjects, setAssignedProjects] = useState<Set<string>>(new Set());
  const [assignedFolders, setAssignedFolders] = useState<Set<string>>(new Set());
  const [assignedForms, setAssignedForms] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
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
    const loadAssignments = async () => {
      setLoading(true);
      const projRes = await Promise.all(projects.map((p) => getProjectAssignmentsApi(p.id)));
      const projIds = new Set<string>();
      projRes.forEach((r, i) => {
        if (r.data?.some((a) => a.userId === userId)) projIds.add(projects[i].id);
      });
      setAssignedProjects(projIds);

      const formIds = new Set<string>();
      const allForms = folders.flatMap((f) =>
        f.forms.map((fm) => ({ formId: fm.id, folderId: f.id }))
      );
      if (allForms.length > 0) {
        const formRes = await Promise.all(allForms.map((f) => getFormAssignmentsApi(f.formId)));
        formRes.forEach((r, i) => {
          if (r.data?.some((a) => a.userId === userId)) formIds.add(allForms[i].formId);
        });
      }
      setAssignedForms(formIds);

      const folderIds = new Set<string>();
      folders.forEach((folder) => {
        if (!projIds.has(folder.projectId)) {
          const someAssigned = folder.forms.some((fm) => formIds.has(fm.id));
          if (someAssigned) folderIds.add(folder.id);
        }
      });
      setAssignedFolders(folderIds);
      setLoading(false);
    };

    if (projects.length > 0 && folders.length > 0) loadAssignments();
    else if (projects.length > 0) setLoading(false);
  }, [userId, projects.length, folders.length]);

  const toggleProjectExpand = (id: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleProject = (projectId: string) => {
    setAssignedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else {
        next.add(projectId);
        setExpandedProjects((e) => {
          const ne = new Set(e);
          ne.add(projectId);
          return ne;
        });
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string, projectId: string) => {
    if (assignedProjects.has(projectId)) return;
    setAssignedFolders((prev) => {
      const next = new Set(prev);
      const folder = folders.find((f) => f.id === folderId);
      if (next.has(folderId)) {
        next.delete(folderId);
        if (folder)
          setAssignedForms((pf) => {
            const nf = new Set(pf);
            folder.forms.forEach((fm) => nf.delete(fm.id));
            return nf;
          });
      } else {
        next.add(folderId);
        if (folder)
          setAssignedForms((pf) => {
            const nf = new Set(pf);
            folder.forms.forEach((fm) => nf.add(fm.id));
            return nf;
          });
      }
      return next;
    });
  };

  const toggleForm = (formId: string, folderId: string, projectId: string) => {
    if (assignedProjects.has(projectId) || assignedFolders.has(folderId)) return;
    setAssignedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    for (const project of projects) {
      const res = await getProjectAssignmentsApi(project.id);
      const currentlyAssigned = res.data?.some((a) => a.userId === userId) ?? false;
      const shouldBeAssigned = assignedProjects.has(project.id);
      if (shouldBeAssigned && !currentlyAssigned) await assignProjectToUserApi(project.id, userId);
      else if (!shouldBeAssigned && currentlyAssigned)
        await unassignProjectFromUserApi(project.id, userId);
    }
    const allForms = folders.flatMap((f) =>
      f.forms.map((fm) => ({ formId: fm.id, folderId: f.id, projectId: f.projectId }))
    );
    for (const { formId, projectId } of allForms) {
      const res = await getFormAssignmentsApi(formId);
      const currentlyAssigned = res.data?.some((a) => a.userId === userId) ?? false;
      const folder = folders.find((f) => f.forms.some((fm) => fm.id === formId));
      const shouldBeAssigned =
        assignedProjects.has(projectId) ||
        (folder ? assignedFolders.has(folder.id) : false) ||
        assignedForms.has(formId);
      if (shouldBeAssigned && !currentlyAssigned) await assignFormToUserApi(formId, userId);
      else if (!shouldBeAssigned && currentlyAssigned)
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
        <strong>carpeta específica</strong> o <strong>formularios individuales</strong>.
      </p>

      <div className="mb-4 overflow-hidden rounded-[10px] border border-slate-200">
        {projects.map((project, pi) => {
          const projectFolders = folders.filter((f) => f.projectId === project.id);
          const isExpanded = expandedProjects.has(project.id);
          const isProjAssigned = assignedProjects.has(project.id);

          return (
            <div
              key={project.id}
              className={pi < projects.length - 1 ? "border-b border-slate-100" : ""}
            >
              <div
                className="flex items-center gap-2.5 px-3.5 py-3"
                style={{ background: isProjAssigned ? "#f0fdf4" : "#fff" }}
              >
                <div
                  onClick={() => toggleProject(project.id)}
                  className="flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded"
                  style={{
                    border: `2px solid ${isProjAssigned ? ACCENT : "#d1d5db"}`,
                    background: isProjAssigned ? ACCENT : "#fff",
                  }}
                >
                  {isProjAssigned && (
                    <span className="text-[11px] font-bold text-white">✓</span>
                  )}
                </div>
                <div
                  onClick={() => toggleProjectExpand(project.id)}
                  className="flex flex-1 cursor-pointer items-center gap-2"
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[13px]"
                    style={{ background: project.color + "28", color: project.color }}
                  >
                    {project.icon}
                  </div>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: isProjAssigned ? "#065f46" : "#111827" }}
                  >
                    {project.name}
                  </span>
                  {isProjAssigned && (
                    <span className="rounded-[10px] bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
                      Completo
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-400">
                  {projectFolders.reduce((a, f) => a + f.forms.length, 0)} formularios
                </span>
                <span
                  onClick={() => toggleProjectExpand(project.id)}
                  className="flex cursor-pointer text-gray-400 transition-transform"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>

              {isExpanded &&
                projectFolders.map((folder) => {
                  const isFolderAssigned = isProjAssigned || assignedFolders.has(folder.id);
                  const folderDisabled = isProjAssigned;

                  return (
                    <div key={folder.id}>
                      <div
                        className="flex items-center gap-2.5 border-t border-slate-100 py-2 pl-10 pr-3.5"
                        style={{ background: isFolderAssigned ? "#f0fdf4" : "#fafafa" }}
                      >
                        <div
                          onClick={() => !folderDisabled && toggleFolder(folder.id, project.id)}
                          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px]"
                          style={{
                            border: `2px solid ${isFolderAssigned ? ACCENT : "#d1d5db"}`,
                            background: isFolderAssigned ? ACCENT : "#fff",
                            cursor: folderDisabled ? "default" : "pointer",
                            opacity: folderDisabled ? 0.6 : 1,
                          }}
                        >
                          {isFolderAssigned && (
                            <span className="text-[10px] font-bold text-white">✓</span>
                          )}
                        </div>
                        <span className="text-[13px]">{folder.icon}</span>
                        <span
                          className="flex-1 text-xs font-semibold"
                          style={{ color: isFolderAssigned ? "#065f46" : "#374151" }}
                        >
                          {folder.name}
                        </span>
                        {isProjAssigned && (
                          <span className="text-[10px] italic text-gray-400">incluida</span>
                        )}
                        {!isProjAssigned && assignedFolders.has(folder.id) && (
                          <span className="rounded-[10px] bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
                            Carpeta completa
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {folder.forms.length} forms
                        </span>
                      </div>

                      {folder.forms.map((form) => {
                        const isFormAssigned =
                          isProjAssigned ||
                          assignedFolders.has(folder.id) ||
                          assignedForms.has(form.id);
                        const formDisabled =
                          isProjAssigned || assignedFolders.has(folder.id);
                        return (
                          <div
                            key={form.id}
                            className="flex items-center gap-2.5 border-t border-slate-100 py-1.5 pl-[66px] pr-3.5"
                            style={{ background: isFormAssigned ? "#f0fdf4" : "#fafafa" }}
                          >
                            <div
                              onClick={() =>
                                !formDisabled && toggleForm(form.id, folder.id, project.id)
                              }
                              className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px]"
                              style={{
                                border: `2px solid ${isFormAssigned ? ACCENT : "#d1d5db"}`,
                                background: isFormAssigned ? ACCENT : "#fff",
                                cursor: formDisabled ? "default" : "pointer",
                                opacity: formDisabled ? 0.6 : 1,
                              }}
                            >
                              {isFormAssigned && (
                                <span className="text-[9px] font-bold text-white">✓</span>
                              )}
                            </div>
                            <span className="text-[11px]">📋</span>
                            <span
                              className="flex-1 text-xs"
                              style={{ color: isFormAssigned ? "#065f46" : "#6b7280" }}
                            >
                              {form.name}
                            </span>
                            {formDisabled && (
                              <span className="text-[10px] italic text-gray-400">
                                incluido
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg border-none px-5 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed"
        style={{ background: saved ? "#10b981" : ACCENT }}
      >
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "💾 Guardar asignaciones"}
      </button>
    </div>
  );
}
