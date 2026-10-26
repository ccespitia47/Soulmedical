import { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import "../../utils/pdfWorker";
import type { PdfFieldMapping } from "../../types/email-template.types";
import {
  fetchFilledPdfPreview,
  fetchRenderedPdfFile,
} from "../../services/pdfPreview";

type PlaceholderItem = {
  placeholder: string;
  description: string;
};

type PdfPreviewProps = {
  pdfBase64: string;
  mappings: PdfFieldMapping[];
  availablePlaceholders: PlaceholderItem[];
  formValues?: Record<string, string>;
  onClose: () => void;
};

/**
 * Modal de preview del PDF adjunto — muestra el PDF con los placeholders
 * ya reemplazados por valores (o su etiqueta entre corchetes si no hay
 * valor real). Usa el backend (pdf-lib) para el llenado, misma arquitectura
 * que ExcelPreview.
 */
export default function PdfPreview({
  pdfBase64,
  mappings,
  availablePlaceholders,
  formValues,
  onClose,
}: PdfPreviewProps) {
  const [filledPdf, setFilledPdf] = useState<string>("");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Placeholders sin valor real reciben "[Descripción]" para que se vea
  // dónde caerá cada campo en el PDF final.
  const values: Record<string, string> = (() => {
    const out: Record<string, string> = {};
    for (const p of availablePlaceholders) {
      const key = p.placeholder.replace(/^\$\{/, "").replace(/\}$/, "");
      out[key] =
        formValues && formValues[p.placeholder] !== undefined
          ? formValues[p.placeholder]
          : `[${p.description}]`;
    }
    return out;
  })();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await fetchFilledPdfPreview({
        pdfBase64,
        mappings: mappings.map((m) => ({
          placeholder: m.placeholder,
          x: m.x,
          y: m.y,
          page: m.page,
          fontSize: m.fontSize,
        })),
        values,
      });
      if (cancelled) return;
      if (result.error || !result.pdfBase64) {
        setError(result.error ?? "Sin respuesta del servidor");
        setLoading(false);
        return;
      }
      setFilledPdf(result.pdfBase64);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBase64, mappings, formValues]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const result = await fetchRenderedPdfFile({
        pdfBase64,
        mappings: mappings.map((m) => ({
          placeholder: m.placeholder,
          x: m.x,
          y: m.y,
          page: m.page,
          fontSize: m.fontSize,
        })),
        values,
        filename: "formulario",
      });
      if (result.error || !result.blob) {
        alert(`Error al descargar: ${result.error ?? "sin blob"}`);
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "formulario.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-[4px]">
      <div className="flex max-h-[95vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-900">
              📄 Preview del PDF
            </h2>
            <p className="m-0 mt-0.5 text-xs text-slate-500">
              {formValues
                ? "Vista con los datos reales del envío"
                : "Los placeholders sin valor real se muestran entre corchetes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={exporting || loading}
              className="cursor-pointer rounded-lg border-none bg-red-600 px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "⏳ Descargando…" : "⬇️ Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        {totalPages > 1 && !loading && !error && (
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="cursor-pointer rounded border border-slate-200 bg-white px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="cursor-pointer rounded border border-slate-200 bg-white px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Zoom:</span>
              <button
                type="button"
                onClick={() => setScale(Math.max(0.5, scale - 0.2))}
                className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                −
              </button>
              <span className="min-w-[45px] text-center text-xs">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale(Math.min(2.5, scale + 0.2))}
                className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 justify-center overflow-auto bg-slate-200 p-6">
          {loading && (
            <div className="flex w-full items-center justify-center gap-2 text-slate-500">
              ⏳ Rellenando PDF con los placeholders…
            </div>
          )}
          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-red-600">
              ❌ {error}
            </div>
          )}
          {!loading && !error && filledPdf && (
            <Document
              file={filledPdf}
              onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
              onLoadError={(err) => setError(`Error PDF: ${err.message}`)}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
