import { useRef } from "react";
import RichTextEditor from "../RichTextEditor";
import PlaceholderPanel from "./PlaceholderPanel";

type Placeholder = { placeholder: string; description: string };

type EmailBodyEditorProps = {
  value: string;
  codeMode: boolean;
  hasError: boolean;
  placeholders: Placeholder[];
  onChange: (html: string) => void;
  onToggleCodeMode: () => void;
  onLoadTemplate: () => void;
  onClear: () => void;
  onPreview: () => void;
};

const BTN_BASE = "cursor-pointer rounded-md border-none px-3 py-1 text-[11px] font-semibold";

export default function EmailBodyEditor({
  value,
  codeMode,
  hasError,
  placeholders,
  onChange,
  onToggleCodeMode,
  onLoadTemplate,
  onClear,
  onPreview,
}: EmailBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const insertIntoTextarea = (placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = value.substring(0, start) + placeholder + value.substring(end);
    onChange(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const insertIntoRich = (placeholder: string) => {
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      const candidate = sel.getRangeAt(0);
      const ancestor = candidate.commonAncestorContainer;
      const parent =
        ancestor.nodeType === 1 ? (ancestor as Element) : (ancestor as Text).parentElement;
      if (parent?.closest("[contenteditable]")) range = candidate;
    }
    if (!range && savedRangeRef.current) {
      range = savedRangeRef.current;
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    if (range) {
      const editorEl = (
        range.commonAncestorContainer.nodeType === 1
          ? (range.commonAncestorContainer as Element)
          : (range.commonAncestorContainer as Text).parentElement
      )?.closest("[contenteditable]") as HTMLElement | null;

      if (editorEl) {
        range.deleteContents();
        const textNode = document.createTextNode(placeholder);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();
        editorEl.dispatchEvent(new Event("input", { bubbles: true }));
        onChange(editorEl.innerHTML);
        return;
      }
    }
    onChange(value + placeholder);
  };

  const handleInsert = codeMode ? insertIntoTextarea : insertIntoRich;

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  return (
    <div
      className="mb-6 rounded-xl border-2 bg-slate-50 p-5"
      style={{ borderColor: hasError ? "#fca5a5" : "#e2e8f0" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📧</span>
          <h3
            className="m-0 text-[15px] font-bold"
            style={{ color: hasError ? "#dc2626" : "#111827" }}
          >
            Cuerpo del Email
            {hasError && (
              <span className="ml-1 text-xs font-normal text-red-600">— Requerido</span>
            )}
          </h3>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={onLoadTemplate} className={`${BTN_BASE} bg-blue-500 text-white`}>
            📄 Cargar plantilla
          </button>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className={`${BTN_BASE} border border-red-200 bg-red-50 text-red-500`}
            >
              🗑️ Borrar
            </button>
          )}
          <button type="button" onClick={onPreview} className={`${BTN_BASE} bg-violet-500 text-white`}>
            👁️ Preview
          </button>
          <button
            type="button"
            onClick={onToggleCodeMode}
            className={`${BTN_BASE} text-white`}
            style={{ background: codeMode ? "#10b981" : "#f59e0b" }}
          >
            {codeMode ? "📝 Modo Visual" : "💻 Ver Código"}
          </button>
        </div>
      </div>

      <PlaceholderPanel placeholders={placeholders} onInsert={handleInsert} />

      {codeMode ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="<h1>Hola</h1><p>Contenido del email...</p>"
          className="box-border min-h-[250px] w-full resize-y rounded-lg border-[1.5px] bg-slate-800 p-3 font-mono text-xs text-slate-200"
          style={{ borderColor: hasError ? "#fca5a5" : "#e2e8f0" }}
        />
      ) : (
        <div onMouseUp={saveRange} onKeyUp={saveRange}>
          <RichTextEditor
            value={value}
            onChange={onChange}
            placeholder="Escribe el contenido del email aquí..."
          />
        </div>
      )}
    </div>
  );
}
