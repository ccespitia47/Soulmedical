import { useEffect } from "react";
import BuilderLayout from "../components/builder/BuilderLayout";
import { useBuilderStore } from "../store/useBuilderStore";
import { useFolderStore } from "../store/useFolderStore";

type BuilderPageProps = {
  folderId?: string;
  formId?: string;
  onBack?: () => void;
};

export default function BuilderPage({ folderId, formId, onBack }: BuilderPageProps) {
  const { setWidgets, clearWidgets } = useBuilderStore();
  const folders = useFolderStore((s) => s.folders);
  const loadFormDetails = useFolderStore((s) => s.loadFormDetails);

  useEffect(() => {
    if (!folderId || !formId) return;

    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);

    // Si el form del store aún está en modo "resumen" (sin widgets porque
    // loadFolders solo trae un summary liviano) pedimos el detalle completo
    // al backend. En cuanto se actualiza el store, este effect se dispara
    // de nuevo con los widgets reales y hidrata el BuilderStore.
    if (form && (!form.widgets || form.widgets.length === 0)) {
      void loadFormDetails(folderId, formId);
      clearWidgets();
      return;
    }

    if (form?.widgets && form.widgets.length > 0) {
      // Pasar el formId para que FormRoute sepa qué formulario está en el builder
      setWidgets(form.widgets, formId);
    } else {
      clearWidgets();
    }
  }, [folderId, formId, folders, loadFormDetails, setWidgets, clearWidgets]);

  return <BuilderLayout folderId={folderId} formId={formId} onBack={onBack} />;
}