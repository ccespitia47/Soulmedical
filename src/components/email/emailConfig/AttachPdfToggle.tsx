import { useRef } from "react";
import type { AppPlaceholder } from "../../../utils/placeholders";
import { renderFilename } from "../../../utils/placeholders";

type AttachPdfToggleProps = {
  attachPDF: boolean;
  pdfFilename: string;
  placeholders?: AppPlaceholder[];
  onChangeAttach: (v: boolean) => void;
  onChangeFilename: (v: string) => void;
};

export default function AttachPdfToggle({
  attachPDF,
  pdfFilename,
  placeholders = [],
  onChangeAttach,
  onChangeFilename,
}: AttachPdfToggleProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Inserta el placeholder en la posición del cursor (o al final si no hay foco)
  const insertAtCursor = (snippet: string) => {
    const el = inputRef.current;
    if (!el) {
      onChangeFilename(`${pdfFilename}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? pdfFilename.length;
    const end = el.selectionEnd ?? pdfFilename.length;
    const next = pdfFilename.slice(0, start) + snippet + pdfFilename.slice(end);
    onChangeFilename(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Preview: cómo se verá el nombre con datos de ejemplo
  const sampleData: Record<string, string> = {};
  for (const p of placeholders) {
    const key = p.placeholder.replace(/^\$\{|\}$/g, "");
    sampleData[key] = p.description;
  }
  const previewName = renderFilename(pdfFilename, sampleData);

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-gray-50 p-3">
        <input
          type="checkbox"
          checked={attachPDF}
          onChange={(e) => onChangeAttach(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
        />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-gray-900">
            Adjuntar PDF al email
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            Se generará el PDF y se adjuntará automáticamente
          </div>
        </div>
      </label>

      {attachPDF && (
        <div className="ml-7 mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
            Nombre del archivo PDF
          </label>
          <input
            ref={inputRef}
            type="text"
            value={pdfFilename}
            onChange={(e) => onChangeFilename(e.target.value)}
            placeholder="Consentimiento_${nombre}_${fecha}.pdf"
            className="w-full max-w-[460px] rounded-md border-[1.5px] border-slate-200 px-2.5 py-1.5 text-xs"
          />

          {placeholders.length > 0 && (
            <>
              <div className="mt-2.5 mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">
                Insertar placeholder en el nombre
              </div>
              <div className="flex max-h-[88px] flex-wrap gap-1.5 overflow-y-auto">
                {placeholders.map((p) => (
                  <button
                    key={p.placeholder}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertAtCursor(p.placeholder);
                    }}
                    className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-800 hover:bg-emerald-100"
                    title={p.description}
                  >
                    {p.placeholder}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-2 text-[10.5px] text-gray-400">
            💡 Se permite usar placeholders y se reemplazan al enviar. Ejemplo:
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700">
              {pdfFilename || "formulario.pdf"}
            </code>
            {placeholders.length > 0 && pdfFilename && (
              <span>
                {" "}→{" "}
                <code className="rounded bg-emerald-50 px-1 py-0.5 font-mono text-[10px] text-emerald-700">
                  {previewName}
                </code>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
