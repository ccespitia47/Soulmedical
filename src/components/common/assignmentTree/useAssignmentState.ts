import { useState } from "react";
import type { FolderItem } from "../../../types/folder.types";

/**
 * Estado y togglers compartidos por AssignmentsTab (users) y
 * GroupAssignmentsPanel (groups). La carga inicial y el guardado son
 * responsabilidad del wrapper porque cada uno usa endpoints distintos.
 *
 * Soporta jerarquía con exclusiones:
 * - Proyecto → Carpeta → Formulario
 * - Si proyecto asignado → carpeta hereda (excluir con excludedFolders)
 * - Si carpeta excluida → forms heredan exclusión (excluir con excludedForms para override)
 */
export function useAssignmentState() {
  const [assignedProjects, setAssignedProjects] = useState<Set<string>>(new Set());
  const [assignedFolders, setAssignedFolders] = useState<Set<string>>(new Set());
  const [assignedForms, setAssignedForms] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [excludedFolders, setExcludedFolders] = useState<Set<string>>(new Set());
  const [excludedForms, setExcludedForms] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleProject = (projectId: string, folders: FolderItem[]) => {
    setAssignedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        // Al des-asignar el proyecto, limpiar todas las exclusiones que colgaban
        // de él (folder-excl + form-excl de forms cuyo folder está en el project).
        const projectFolders = folders.filter((f) => f.projectId === projectId);
        const folderIds = new Set(projectFolders.map((f) => f.id));
        const formIds = new Set(
          projectFolders.flatMap((f) => f.forms.map((fm) => fm.id)),
        );
        setExcludedFolders((pf) => {
          const nf = new Set(pf);
          folderIds.forEach((id) => nf.delete(id));
          return nf;
        });
        setExcludedForms((pf) => {
          const nf = new Set(pf);
          formIds.forEach((id) => nf.delete(id));
          return nf;
        });
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
    const projectAssigned = assignedProjects.has(projectId);

    if (projectAssigned) {
      // El proyecto está asignado → toggle exclusión de carpeta.
      setExcludedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
          // Al excluir la carpeta, limpiar excludedForms de sus forms
          // (ya no aportan nada; la carpeta entera está excluida).
          const folder = folders.find((f) => f.id === folderId);
          if (folder) {
            setExcludedForms((pf) => {
              const nf = new Set(pf);
              folder.forms.forEach((fm) => nf.delete(fm.id));
              return nf;
            });
          }
        }
        return next;
      });
      return;
    }

    // Comportamiento actual: toggle en assignedFolders + arrastrar assignedForms.
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
    const projectAssigned = assignedProjects.has(projectId);
    const folderExcluded = excludedFolders.has(folderId);
    const inheritsFromProject = projectAssigned && !folderExcluded;

    if (folderExcluded) {
      // Carpeta excluida: no permitir togglear forms hasta que se re-incluya.
      return;
    }

    // Herencia por PROYECTO: usar excludedForms (necesitamos marcar exclusión).
    if (inheritsFromProject) {
      setExcludedForms((prev) => {
        const next = new Set(prev);
        if (next.has(formId)) next.delete(formId);
        else next.add(formId);
        return next;
      });
      return;
    }

    // Herencia por CARPETA directa: la carpeta pobló assignedForms, así que
    // toggle in-place ahí (no usar excludedForms para evitar duplicados que
    // fallan la validación backend "forms y excludedForms simultáneamente").
    setAssignedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const isFolderEffectivelyAssigned = (folderId: string, projectId: string) => {
    const isDirect = assignedFolders.has(folderId);
    const inheritsFromProject = assignedProjects.has(projectId);
    const isExcluded = excludedFolders.has(folderId);
    return (isDirect || inheritsFromProject) && !isExcluded;
  };

  const isFormEffectivelyAssigned = (
    formId: string,
    folderId: string,
    projectId: string,
  ) => {
    const isDirect = assignedForms.has(formId);
    const inheritsFromProject =
      assignedProjects.has(projectId) && !excludedFolders.has(folderId);
    const inheritsFromFolder = assignedFolders.has(folderId);
    const isExcluded = excludedForms.has(formId) || excludedFolders.has(folderId);
    return (isDirect || inheritsFromProject || inheritsFromFolder) && !isExcluded;
  };

  return {
    assignedProjects,
    assignedFolders,
    assignedForms,
    excludedFolders,
    excludedForms,
    expandedProjects,
    setAssignedProjects,
    setAssignedFolders,
    setAssignedForms,
    setExcludedFolders,
    setExcludedForms,
    toggleExpand,
    toggleProject,
    toggleFolder,
    toggleForm,
    isFolderEffectivelyAssigned,
    isFormEffectivelyAssigned,
  };
}
