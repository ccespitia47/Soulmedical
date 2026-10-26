import { useEffect, useRef, useState } from "react";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";
import {
  fetchFilledPreview,
  fetchRenderedPdf,
} from "../../services/excelPreview";
import PreviewHeader from "./excelPreview/PreviewHeader";
import PreviewFooter from "./excelPreview/PreviewFooter";

type PlaceholderItem = {
  placeholder: string;
  description: string;
};

type ExcelPreviewProps = {
  excelBase64: string;
  mappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  customLogoBase64?: string;
  formValues?: Record<string, string>;
  onClose: () => void;
};

/**
 * Preview del PDF que se enviará. Renderiza el .xlsx con placeholders
 * ya rellenados usando LibreOffice en el backend (mismo motor que el
 * mapper, por eso se ve idéntico al Excel original). Permite descargar
 * el PDF real (también generado con LibreOffice).
 */
export default function ExcelPreview({
  excelBase64,
  mappings,
  availablePlaceholders,
  customLogoBase64,
  formValues,
  onClose,
}: ExcelPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [html, setHtml] = useState<string>("");
  const [css, setCss] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los placeholders sin valor real reciben un texto tipo "[Descripción]"
  // para que el admin pueda ver DÓNDE va cada campo aunque no haya datos.
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
      const result = await fetchFilledPreview({
        excelBase64,
        mappings: mappings.map((m) => ({ coord: m.coord, placeholder: m.placeholder })),
        values,
        customLogoBase64,
      });
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setHtml(result.html);
      setCss(result.css);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excelBase64, mappings, customLogoBase64, formValues]);

  // Montamos el shadow root y poblamos el HTML en el MISMO efecto porque el
  // `<div ref={hostRef}>` solo se renderiza cuando `!loading && !error`. Si
  // separamos el montaje en un useEffect con [], corre antes de que el div
  // exista y `hostRef.current` es null → shadow nunca se crea.
  useEffect(() => {
    if (loading || error || !html) return;
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: "open" });
    }
    shadowRef.current.innerHTML = `
      <style>
        :host { display: block; }
        ${css}
        .preview-wrapper { background: #fff; padding: 16px; overflow: auto; max-height: 70vh; }
      </style>
      <div class="preview-wrapper">${html}</div>
    `;
  }, [loading, error, html, css]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const result = await fetchRenderedPdf({
        excelBase64,
        mappings: mappings.map((m) => ({ coord: m.coord, placeholder: m.placeholder })),
        values,
        customLogoBase64,
        filename: "formulario",
      });
      if (result.error || !result.blob) {
        alert(`Error al generar el PDF: ${result.error ?? "sin blob"}`);
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
        <PreviewHeader
          hasFormValues={!!formValues}
          exporting={exporting}
          loading={loading}
          onExportPdf={handleExportPDF}
          onClose={onClose}
        />

        <div className="flex flex-1 justify-center overflow-auto bg-slate-100 p-6">
          {loading && (
            <div className="flex w-full items-center justify-center gap-2 text-slate-500">
              ⏳ Generando vista previa con LibreOffice…
            </div>
          )}
          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-red-600">
              ❌ {error}
            </div>
          )}
          {!loading && !error && (
            <div ref={hostRef} className="w-full" />
          )}
        </div>

        <PreviewFooter hasFormValues={!!formValues} />
      </div>
    </div>
  );
}
