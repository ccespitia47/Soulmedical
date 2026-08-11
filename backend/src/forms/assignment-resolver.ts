export type AssignmentRow = {
  formId: string | null;
  folderId: string | null;
  projectId: string | null;
  excluded: boolean;
};

/**
 * Dado el set de assignments (positivos + exclusiones) para uno o varios
 * sujetos (user + sus groups), y el catálogo de todos los forms con su
 * folder/project ancestro, devuelve el set de formIds accesibles.
 */
export function resolveAccessibleFormIds(
  assignments: AssignmentRow[],
  allForms: Array<{ id: string; folderId: string; projectId: string }>,
): Set<string> {
  const posProjects = new Set(
    assignments.filter((a) => !a.excluded && a.projectId).map((a) => a.projectId!),
  );
  const posFolders = new Set(
    assignments.filter((a) => !a.excluded && a.folderId).map((a) => a.folderId!),
  );
  const posForms = new Set(
    assignments.filter((a) => !a.excluded && a.formId).map((a) => a.formId!),
  );
  const excFolders = new Set(
    assignments.filter((a) => a.excluded && a.folderId).map((a) => a.folderId!),
  );
  const excForms = new Set(
    assignments.filter((a) => a.excluded && a.formId).map((a) => a.formId!),
  );

  const result = new Set<string>();
  for (const f of allForms) {
    const inheritsFromProject =
      posProjects.has(f.projectId) && !excFolders.has(f.folderId);
    const inheritsFromFolder = posFolders.has(f.folderId);
    const isDirect = posForms.has(f.id);
    const isExcluded = excForms.has(f.id) || excFolders.has(f.folderId);
    if ((isDirect || inheritsFromProject || inheritsFromFolder) && !isExcluded) {
      result.add(f.id);
    }
  }
  return result;
}
