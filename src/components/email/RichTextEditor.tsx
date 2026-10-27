import { useEffect, useRef } from "react";
import Toolbar from "./richTextEditor/Toolbar";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Si se pasa, la ✕ roja de la toolbar limpia TODO el contenido (no solo
   *  el formato). Útil para email body: botón "limpiar plantilla". */
  onClearAll?: () => void;
  /** Si se pasa, aparece un botón "Plantilla" al lado de la ✕ en la toolbar
   *  para cargar la plantilla por defecto. */
  onLoadTemplate?: () => void;
};

/**
 * Si `value` llega como documento HTML completo (<!DOCTYPE>, <html>, <head>
 * con <style>), lo normalizamos: devolvemos SOLO el contenido del <body>.
 * Meterlo tal cual en un contenteditable descarta <html>/<head> pero deja
 * flotando el <style>, que rompe el editor y afecta el resto de la app.
 */
function extractEditableBody(html: string): string {
  if (!html) return "";
  // Shortcut: si no incluye <html, es un fragmento ya editable.
  if (!/<html[\s>]/i.test(html) && !/<!doctype/i.test(html)) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body?.innerHTML ?? html;
  } catch {
    return html;
  }
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  onClearAll,
  onLoadTemplate,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const safe = extractEditableBody(value);
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== safe && safe !== undefined) {
        editorRef.current.innerHTML = safe;
        // Si vino un documento completo y lo recortamos al body, avisamos
        // al parent para que `value` quede alineado con lo que realmente
        // está en el editor — así los próximos cambios no vuelven a chocar.
        if (safe !== value) onChange(safe);
      }
    }
    isUpdatingRef.current = false;
  }, [value, onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current?.contains(selection.anchorNode)
    ) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedSelection.current) return;
    const selection = window.getSelection();
    if (selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedSelection.current);
      } catch (e) {
        console.warn("Could not restore selection:", e);
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    handleInput();
  };

  const applyColor = (type: "text" | "background", color: string) => {
    execCommand(type === "text" ? "foreColor" : "backColor", color);
  };

  const handleInsertLink = () => {
    const url = prompt("URL del enlace:");
    if (url) execCommand("createLink", url);
  };

  return (
    <div className="overflow-hidden rounded-lg border-[1.5px] border-slate-200 bg-white">
      <Toolbar
        onCommand={execCommand}
        onApplyColor={applyColor}
        onInsertLink={handleInsertLink}
        onClearAll={onClearAll}
        onLoadTemplate={onLoadTemplate}
      />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Escribe aquí..."}
        onInput={handleInput}
        onBlur={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        className="min-h-[200px] p-4 text-sm leading-relaxed text-gray-900 outline-none"
      />
    </div>
  );
}
