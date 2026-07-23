import { useState } from "react";
import type { FolderItem } from "../../../types/folder.types";

/**
 * Estado y togglers compartidos por AssignmentsTab (users) y
 * GroupAssignmentsPanel (groups). La carga inicial y el guardado son
 * responsabilidad del wrapper porque cada uno usa endpoints distintos.
 */
export function useAssignmentState() {
  const [assignedProjects, setAssignedProjects] = useState<Set<string>>(new Set());
  const [assignedFolders, setAssignedFolders] = useState<Set<string>>(new Set());
  const [assignedForms, setAssignedForms] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleProject = (projectId: string) => {
    setAssignedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
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

  const toggleFolder = (
    folderId: string,
    projectId: string,
    folders: FolderItem[],
  ) => {
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

  return {
    assignedProjects,
    assignedFolders,
    assignedForms,
    expandedProjects,
    setAssignedProjects,
    setAssignedFolders,
    setAssignedForms,
    toggleExpand,
    toggleProject,
    toggleFolder,
    toggleForm,
  };
}
