import { useState } from "react";
import PasteMenu from "./PasteMenu";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";
import type { WidgetInstance, FormRule } from "../../types/widget.types";
import {
  clearClipboard,
  cloneWidgetWithNewId,
  cloneRulesForNewWidget,
  filterViableRulesForForm,
  useClipboardWidget,
} from "../../lib/widgetClone";
import { widgetRegistry } from "../widgets/registry";

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
  const insertWidget = useBuilderStore((s) => s.insertWidget);
  const saveFormWidgets = useFolderStore((s) => s.saveFormWidgets);

  const handlePaste = (withRules: boolean) => {
    // Defensa + diagnóstico: si handlePaste corre pero el widget no
    // aparece, cada rama muestra un toast concreto para que sepamos
    // qué falló (bug reportado: "el botón aparece pero al click no
    // pasa nada"). Antes el único feedback era el toast final de éxito
    // y no había forma de distinguir "no se disparó" de "falló silente".
    console.log("[PasteButton] handlePaste invocado. withRules=", withRules, "clipboard=", clipboard);
    if (!clipboard) {
      setPasteToast("No se pudo pegar: clipboard vacío.");
      setPasteMenuOpen(false);
      setTimeout(() => setPasteToast(null), 4000);
      return;
    }
    if (!widgetRegistry[clipboard.widget.type]) {
      setPasteToast(`No se puede pegar: tipo de widget desconocido ("${clipboard.widget.type}")`);
      setPasteMenuOpen(false);
      setTimeout(() => setPasteToast(null), 4000);
      return;
    }
    try {
      const { widget: cloned, newId } = cloneWidgetWithNewId(clipboard.widget);
      console.log("[PasteButton] widget clonado:", cloned);
      if (typeof insertWidget !== "function") {
        setPasteToast("Error: builder store no está listo. Recargá y volvé a intentar.");
        setPasteMenuOpen(false);
        setTimeout(() => setPasteToast(null), 5000);
        return;
      }
      const beforeCount = useBuilderStore.getState().widgets.length;
      insertWidget(cloned);
      const afterState = useBuilderStore.getState();
      const afterCount = afterState.widgets.length;
      console.log(
        `[PasteButton] widgets en store: ${beforeCount} → ${afterCount}`,
      );

      // Guardado automático fire-and-forget: sin esto Sara debía darle
      // "Guardar" y si navegaba a otro form primero el widget se perdía
      // (el store se rehidrata con los widgets del form destino al montar
      // BuilderPage). Persistir de inmediato evita esa pérdida silenciosa.
      if (folderId && formId) {
        void saveFormWidgets(folderId, formId, afterState.widgets).catch(
          (err) => console.error("[PasteButton] Error guardando:", err),
        );
      }

      let toastMsg =
        afterCount > beforeCount
          ? `✅ Widget "${cloned.label}" pegado y guardado`
          : `⚠️ Widget "${cloned.label}" NO se agregó al canvas (revisá consola)`;

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
    } catch (err) {
      console.error("[PasteButton] Error pegando widget:", err);
      setPasteToast(
        `Error al pegar: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    setPasteMenuOpen(false);
    setTimeout(() => setPasteToast(null), 5000);
  };

  return (
    <>
      {clipboard && (
        <div style={{ position: "relative", display: "inline-flex", alignItems: "stretch", border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#fff", transition: "border-color 0.15s ease" }}>
          <button
            onClick={() => setPasteMenuOpen((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0891b2", fontFamily: "inherit" }}
            title={`Pegar "${clipboard.widget.label}"`}
          >
            📋 Pegar "{clipboard.widget.label.length > 20 ? `${clipboard.widget.label.slice(0, 20)}…` : clipboard.widget.label}"
          </button>
          <button
            onClick={() => { clearClipboard(); setPasteMenuOpen(false); }}
            aria-label="Cancelar pegar widget"
            title="Cancelar (vaciar clipboard)"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 9px", border: "none", borderLeft: "1px solid #e2e8f0", background: "transparent", cursor: "pointer", color: "#94a3b8", fontSize: 14, fontFamily: "inherit", transition: "background 0.15s ease, color 0.15s ease" }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            ✕
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
