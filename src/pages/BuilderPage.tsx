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
  const { folders } = useFolderStore();

  useEffect(() => {
    if (!folderId || !formId) return;

    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);

    if (form?.widgets && form.widgets.length > 0) {
      // Pasar el formId para que FormRoute sepa qué formulario está en el builder
      setWidgets(form.widgets, formId);
    } else {
      clearWidgets();
    }
  }, [folderId, formId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <BuilderLayout folderId={folderId} formId={formId} onBack={onBack} />;
}