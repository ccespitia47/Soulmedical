import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeHtml } from "../../utils/sanitize";

type Placeholder = {
  placeholder: string;
  description: string;
};

type HtmlCellMapperProps = {
  html: string;
  placeholders: Placeholder[];
  onSave: (nextHtml: string) => void;
  onClose: () => void;
};

/**
 * Editor visual del HTML del template como un único documento WYSIWYG.
 * Separamos los <style> del contenido editable para garantizar que las
 * reglas CSS (bordes de tabla, colores de header) se conserven al guardar,
 * incluso si el sanitizador o el contentEditable manipulan el DOM.
 *
 * Mientras el modal está abierto, los <style> se inyectan en <head> con un
 * scope hacia el wrapper del editor para que se vea exactamente igual que
 * en el PDF final.
 */
export default function HtmlCellMapper({
  html,
  placeholders,
  onSave,
  onClose,
}: HtmlCellMapperProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRangeRef = useRef<Range | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Separamos <style> del resto. El editor solo edita el contenido visible;
  // los estilos se preservan tal cual y se reincorporan al guardar.
  const { styles, body } = useMemo(() => extractStylesAndBody(html), [html]);

  // Inyectamos los <style> en el <head> mientras el modal vive, así el
  // editor WYSIWYG se ve con tabla bonita, fondos verdes, etc.
  useEffect(() => {
    if (!styles.trim()) return;
    const el = document.createElement("style");
    el.setAttribute("data-html-cell-mapper", "true");
    el.textContent = styles;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [styles]);

  const captureRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    if (!sel) return;

    let range: Range;
    if (
      lastRangeRef.current &&
      editor.contains(lastRangeRef.current.commonAncestorContainer)
    ) {
      range = lastRangeRef.current;
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    range.deleteContents();
    const node = document.createTextNode(placeholder);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    lastRangeRef.current = range.cloneRange();
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!editorRef.current) return;
    // Sanitizamos solo el contenido editado; los <style> se concatenan
    // crudos al inicio para no perder ni una regla CSS.
    const cleanedBody = sanitizeHtml(editorRef.current.innerHTML);
    const stylesBlock = styles.trim()
      ? `<style type="text/css">${styles}</style>\n`
      : "";
    onSave(`${stylesBlock}${cleanedBody}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[92vh] w-full max-w-[1100px] flex-col rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="m-0 text-lg font-bold text-gray-900">
              📍 Editor visual del PDF
            </h2>
            <p className="m-0 mt-0.5 text-[12px] text-gray-500">
              Edita el contenido directamente sobre la vista del formato. Los
              estilos <code>&lt;style&gt;</code> de la plantilla se preservan
              automáticamente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-2xl text-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Barra de placeholders */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase text-gray-500">
            Insertar placeholder donde está el cursor
          </div>
          {placeholders.length === 0 ? (
            <span className="text-[12px] italic text-gray-400">
              No hay placeholders disponibles. Agrega widgets al formulario para
              ver opciones aquí.
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p, i) => (
                <button
                  key={`${p.placeholder}-${i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertPlaceholder(p.placeholder);
                  }}
                  className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-800 hover:bg-emerald-100"
                  title={p.description}
                >
                  {p.placeholder}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor: HTML completo renderizado y editable */}
        <div className="flex-1 overflow-y-auto bg-[#f0f4f8] p-6">
          <div className="mx-auto max-w-[820px] rounded-lg bg-white p-6 shadow-sm">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => setHasChanges(true)}
              onKeyUp={captureRange}
              onMouseUp={captureRange}
              onFocus={captureRange}
              className="min-h-[400px] outline-none focus:outline-2 focus:outline-emerald-200"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
            />
          </div>
          <div className="mx-auto mt-3 max-w-[820px] space-y-1 text-[11px] text-gray-500">
            <p className="m-0">
              💡 Los placeholders <code>${"${campo}"}</code> se reemplazan por
              los datos reales del formulario cuando se genera el PDF.
            </p>
            {styles.trim() && (
              <p className="m-0 text-emerald-700">
                🎨 Esta plantilla tiene estilos CSS embebidos — se conservarán
                al guardar.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4">
          <span className="text-[12px] text-gray-400">
            {hasChanges ? "✏️ Hay cambios sin aplicar" : "Sin cambios"}
          </span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2.5 text-sm font-semibold text-gray-500"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-6 py-2.5 text-sm font-semibold text-white"
            >
              💾 Aplicar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extrae todos los <style>...</style> del HTML y devuelve el CSS concatenado
 * + el resto del HTML (sin los <style>). Si el HTML no tiene <style>, devuelve
 * styles vacío y el body intacto.
 */
function extractStylesAndBody(html: string): { styles: string; body: string } {
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: string[] = [];
  const body = html.replace(styleRegex, (_, css: string) => {
    styles.push(css);
    return "";
  });
  return { styles: styles.join("\n\n"), body };
}
