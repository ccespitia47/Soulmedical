import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FormPage from "../../pages/FormPage";
import { useAuthStore } from "../../store/useAuthStore";
import { useFolderStore } from "../../store/useFolderStore";
import { useProjectStore } from "../../store/useProjectStore";
import { ROLE_PERMISSIONS } from "../../types/auth.types";

export default function FormRoute() {
  const navigate = useNavigate();
  const { folderId, formId } = useParams<{ folderId: string; formId: string }>();
  const user = useAuthStore((s) => s.currentUser);
  const { folders, loadAllFolders } = useFolderStore();
  const { projects, loadProjects } = useProjectStore();
  const [loading, setLoading] = useState(false);

  // Si entran directo por URL, folders puede estar vacío. Cargamos proyectos
  // y todas sus carpetas para resolver folderId → form.
  useEffect(() => {
    const hasFolder = folderId && folders.some((f) => f.id === folderId);
    if (hasFolder) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      let ps = projects;
      if (ps.length === 0) {
        await loadProjects();
        ps = useProjectStore.getState().projects;
      }
      if (ps.length > 0) {
        await loadAllFolders(ps.map((p) => p.id));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [folderId, folders, projects, loadProjects, loadAllFolders]);

  const folder = folders.find((f) => f.id === folderId);
  const form = folder?.forms.find((fm) => fm.id === formId);

  const backTo = user && ROLE_PERMISSIONS[user.role].canManageProjects ? "/admin" : "/userapp";

  if (!folderId || !formId) {
    return <div className="p-8 text-center text-gray-500">Formulario no encontrado</div>;
  }

  if (loading && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Cargando formulario...
      </div>
    );
  }

  return (
    <FormPage
      formId={formId}
      folderId={folderId}
      formName={form?.name ?? "Formulario"}
      widgets={form?.widgets ?? []}
      rules={form?.rules ?? []}
      onClose={() => navigate(backTo)}
    />
  );
}
