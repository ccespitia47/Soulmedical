import { useEffect, useRef } from "react";
import Toolbar from "./richTextEditor/Toolbar";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      if (currentHtml !== value && value !== undefined) {
        editorRef.current.innerHTML = value;
      }
    }
    isUpdatingRef.current = false;
  }, [value]);

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
