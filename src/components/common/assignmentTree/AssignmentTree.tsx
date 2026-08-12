import type { FolderItem, ProjectItem } from "../../../types/folder.types";
import EntityIcon from "../EntityIcon";

const ACCENT = "#00c2a8";

type AssignmentTreeProps = {
  projects: ProjectItem[];
  folders: FolderItem[];
  assignedProjects: Set<string>;
  assignedFolders: Set<string>;
  assignedForms: Set<string>;
  excludedFolders: Set<string>;
  excludedForms: Set<string>;
  expandedProjects: Set<string>;
  onToggleExpand: (projectId: string) => void;
  onToggleProject: (projectId: string) => void;
  onToggleFolder: (folderId: string, projectId: string) => void;
  onToggleForm: (formId: string, folderId: string, projectId: string) => void;
};

function ProjectRow({
  project,
  count,
  isExpanded,
  isAssigned,
  onToggleAssigned,
  onToggleExpanded,
}: {
  project: ProjectItem;
  count: number;
  isExpanded: boolean;
  isAssigned: boolean;
  onToggleAssigned: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-3"
      style={{ background: isAssigned ? "#f0fdf4" : "#fff" }}
    >
      <div
        onClick={onToggleAssigned}
        className="flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded"
        style={{
          border: `2px solid ${isAssigned ? ACCENT : "#d1d5db"}`,
          background: isAssigned ? ACCENT : "#fff",
        }}
      >
        {isAssigned && <span className="text-[11px] font-bold text-white">✓</span>}
      </div>
      <div onClick={onToggleExpanded} className="flex flex-1 cursor-pointer items-center gap-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md text-[13px]"
          style={{ background: project.color + "28", color: project.color }}
        >
          <EntityIcon icon={project.icon} size={13} />
        </div>
        <span
          className="text-[13px] font-bold"
          style={{ color: isAssigned ? "#065f46" : "#111827" }}
        >
          {project.name}
        </span>
        {isAssigned && (
          <span className="rounded-[10px] bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
            Completo
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-400">{count} forms</span>
      <span
        onClick={onToggleExpanded}
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
  );
}

function FolderRow({
  folder,
  isProjectAssigned,
  isFolderChecked,
  isFolderExcluded,
  onToggle,
}: {
  folder: FolderItem;
  isProjectAssigned: boolean;
  isFolderChecked: boolean;
  isFolderExcluded: boolean;
  onToggle: () => void;
}) {
  const showHeredaTag = isProjectAssigned && !isFolderExcluded;
  return (
    <div
      className="flex items-center gap-2.5 border-t border-slate-100 py-2 pl-10 pr-3.5"
      style={{
        background: isFolderExcluded
          ? "#fff7ed"
          : isFolderChecked
            ? "#f0fdf4"
            : "#fafafa",
      }}
    >
      <div
        onClick={onToggle}
        className="flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px]"
        style={{
          border: `2px solid ${isFolderChecked ? ACCENT : "#d1d5db"}`,
          background: isFolderChecked ? ACCENT : "#fff",
        }}
      >
        {isFolderChecked && (
          <span className="text-[10px] font-bold text-white">✓</span>
        )}
      </div>
      <span className="flex" style={{ color: folder.color }}>
        <EntityIcon icon={folder.icon} size={14} />
      </span>
      <span
        className="flex-1 text-xs font-semibold"
        style={{
          color: isFolderExcluded
            ? "#9a3412"
            : isFolderChecked
              ? "#065f46"
              : "#374151",
          textDecoration: isFolderExcluded ? "line-through" : "none",
        }}
      >
        {folder.name}
      </span>
      {showHeredaTag && (
        <span className="text-[10px] italic text-emerald-700">hereda del proyecto</span>
      )}
      {isFolderExcluded && (
        <span className="rounded-[10px] bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-900">
          excluida
        </span>
      )}
      {!isProjectAssigned && isFolderChecked && (
        <span className="rounded-[10px] bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
          Carpeta completa
        </span>
      )}
      <span className="text-[11px] text-gray-400">
        {folder.forms.length} forms
      </span>
    </div>
  );
}

function FormRow({
  name,
  isChecked,
  isExcluded,
  isInheritedFromAncestor,
  isBlockedByFolderExclusion,
  onToggle,
}: {
  name: string;
  isChecked: boolean;
  isExcluded: boolean;
  isInheritedFromAncestor: boolean;
  isBlockedByFolderExclusion: boolean;
  onToggle: () => void;
}) {
  const disabled = isBlockedByFolderExclusion;
  return (
    <div
      className="flex items-center gap-2.5 border-t border-slate-100 py-1.5 pl-[66px] pr-3.5"
      style={{
        background:
          isExcluded || isBlockedByFolderExclusion
            ? "#fff7ed"
            : isChecked
              ? "#f0fdf4"
              : "#fafafa",
      }}
    >
      <div
        onClick={() => !disabled && onToggle()}
        className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px]"
        style={{
          border: `2px solid ${isChecked ? ACCENT : disabled ? "#e5e7eb" : "#d1d5db"}`,
          background: isChecked ? ACCENT : disabled ? "#f3f4f6" : "#fff",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {isChecked && <span className="text-[9px] font-bold text-white">✓</span>}
      </div>
      <span className="text-[11px]">📋</span>
      <span
        className="flex-1 text-xs"
        style={{
          color: isExcluded ? "#9a3412" : isChecked ? "#065f46" : "#6b7280",
          textDecoration: isExcluded ? "line-through" : "none",
        }}
      >
        {name}
      </span>
      {isBlockedByFolderExclusion && (
        <span className="rounded-[10px] bg-gray-100 px-1.5 py-px text-[10px] font-semibold text-gray-500">
          carpeta excluida
        </span>
      )}
      {isExcluded && !isBlockedByFolderExclusion && (
        <span className="rounded-[10px] bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-900">
          excluido
        </span>
      )}
      {isChecked && isInheritedFromAncestor && (
        <span className="text-[10px] italic text-gray-400">hereda</span>
      )}
    </div>
  );
}

export default function AssignmentTree({
  projects,
  folders,
  assignedProjects,
  assignedFolders,
  assignedForms,
  excludedFolders,
  excludedForms,
  expandedProjects,
  onToggleExpand,
  onToggleProject,
  onToggleFolder,
  onToggleForm,
}: AssignmentTreeProps) {
  return (
    <div className="mb-4 overflow-hidden rounded-[10px] border border-slate-200">
      {projects.map((project, pi) => {
        const projectFolders = folders.filter((f) => f.projectId === project.id);
        const isExpanded = expandedProjects.has(project.id);
        const isProjAssigned = assignedProjects.has(project.id);
        const totalForms = projectFolders.reduce((a, f) => a + f.forms.length, 0);

        return (
          <div
            key={project.id}
            className={pi < projects.length - 1 ? "border-b border-slate-100" : ""}
          >
            <ProjectRow
              project={project}
              count={totalForms}
              isExpanded={isExpanded}
              isAssigned={isProjAssigned}
              onToggleAssigned={() => onToggleProject(project.id)}
              onToggleExpanded={() => onToggleExpand(project.id)}
            />

            {isExpanded &&
              projectFolders.map((folder) => {
                const isFolderChecked =
                  (isProjAssigned && !excludedFolders.has(folder.id)) ||
                  assignedFolders.has(folder.id);
                const isFolderExcluded = excludedFolders.has(folder.id);
                return (
                  <div key={folder.id}>
                    <FolderRow
                      folder={folder}
                      isProjectAssigned={isProjAssigned}
                      isFolderChecked={isFolderChecked}
                      isFolderExcluded={isFolderExcluded}
                      onToggle={() => onToggleFolder(folder.id, project.id)}
                    />
                    {folder.forms.map((form) => {
                      const inheritsFromProject =
                        isProjAssigned && !isFolderExcluded;
                      const inheritsFromFolder = assignedFolders.has(folder.id);
                      const inheritsFromAncestor =
                        inheritsFromProject || inheritsFromFolder;
                      const isDirect = assignedForms.has(form.id);
                      const isExcluded =
                        excludedForms.has(form.id) || isFolderExcluded;
                      const isChecked =
                        (isDirect || inheritsFromAncestor) && !isExcluded;
                      return (
                        <FormRow
                          key={form.id}
                          name={form.name}
                          isChecked={isChecked}
                          isExcluded={excludedForms.has(form.id) && !isFolderExcluded}
                          isInheritedFromAncestor={inheritsFromAncestor}
                          isBlockedByFolderExclusion={isFolderExcluded}
                          onToggle={() =>
                            onToggleForm(form.id, folder.id, project.id)
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
