import { useState } from "react";
import PasteMenu from "./PasteMenu";
import { useBuilderStore } from "../../store/useBuilderStore";
import type { WidgetInstance, FormRule } from "../../types/widget.types";
import {
  cloneWidgetWithNewId,
  cloneRulesForNewWidget,
  filterViableRulesForForm,
  useClipboardWidget,
} from "../../lib/widgetClone";

type Props = {
  folderId?: string;
  formId?: string;
  widgets: WidgetInstance[];
  rules: FormRule[];
  saveFormRules: (folderId: string, formId: string, rules: FormRule[]) => Promise<void>;
};

/**
 * Botón "Pegar" del top-bar del builder: muestra el widget en clipboard (si
 * hay uno), abre el PasteMenu (solo widget / con reglas) y expone el toast
 * de resultado. Extraído de BuilderLayout para mantenerlo bajo el límite de
 * líneas por archivo.
 */
export default function PasteButton({ folderId, formId, widgets, rules, saveFormRules }: Props) {
  const clipboard = useClipboardWidget();
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const { insertWidget } = useBuilderStore();

  const handlePaste = (withRules: boolean) => {
    if (!clipboard) return;
    const { widget: cloned, newId } = cloneWidgetWithNewId(clipboard.widget);
    insertWidget(cloned);
    let toastMsg = `Widget "${cloned.label}" pegado`;
    if (withRules && clipboard.rules.length > 0 && folderId && formId) {
      // Remapear las rules del clipboard al nuevo id del widget pegado.
      const remapped = cloneRulesForNewWidget(clipboard.rules, clipboard.widget.id, newId);
      // Filtrar rules que referencien widgets que NO existen en el form destino.
      const existingIds = new Set([...widgets.map((w) => w.id), newId]);
      const { viable, discarded } = filterViableRulesForForm(remapped, existingIds);
      if (viable.length > 0) {
        void saveFormRules(folderId, formId, [...rules, ...viable]);
      }
      const parts: string[] = [];
      if (viable.length > 0) parts.push(`${viable.length} regla${viable.length === 1 ? "" : "s"} agregada${viable.length === 1 ? "" : "s"}`);
      if (discarded > 0) parts.push(`${discarded} descartada${discarded === 1 ? "" : "s"} (referencian widgets que no existen aquí)`);
      if (parts.length > 0) toastMsg = `${toastMsg}. ${parts.join(", ")}`;
    }
    setPasteToast(toastMsg);
    setPasteMenuOpen(false);
    setTimeout(() => setPasteToast(null), 4000);
  };

  return (
    <>
      {clipboard && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPasteMenuOpen((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0891b2", fontFamily: "inherit", transition: "all 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#00c2a8"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            title={`Pegar "${clipboard.widget.label}"`}
          >
            📋 Pegar "{clipboard.widget.label.length > 20 ? `${clipboard.widget.label.slice(0, 20)}…` : clipboard.widget.label}"
          </button>
          {pasteMenuOpen && (
            <PasteMenu
              clipboard={clipboard}
              onPaste={handlePaste}
              onClose={() => setPasteMenuOpen(false)}
            />
          )}
        </div>
      )}
      {pasteToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            zIndex: 500,
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          {pasteToast}
        </div>
      )}
    </>
  );
}
