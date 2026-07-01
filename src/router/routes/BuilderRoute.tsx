import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BuilderPage from "../../pages/BuilderPage";
import { useAuthStore } from "../../store/useAuthStore";
import { useFolderStore } from "../../store/useFolderStore";
import { useProjectStore } from "../../store/useProjectStore";
import { ROLE_PERMISSIONS } from "../../types/auth.types";

export default function BuilderRoute() {
  const navigate = useNavigate();
  const { folderId, formId } = useParams<{ folderId: string; formId: string }>();
  const user = useAuthStore((s) => s.currentUser);
  const { folders, loadAllFolders } = useFolderStore();
  const { projects, loadProjects } = useProjectStore();
  const [loading, setLoading] = useState(false);

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

  const backTo = user && ROLE_PERMISSIONS[user.role].canManageProjects ? "/admin" : "/userapp";
  const hasFolder = folderId && folders.some((f) => f.id === folderId);

  if (loading && !hasFolder) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Cargando builder...
      </div>
    );
  }

  return (
    <BuilderPage
      folderId={folderId}
      formId={formId}
      onBack={() => navigate(backTo)}
    />
  );
}
