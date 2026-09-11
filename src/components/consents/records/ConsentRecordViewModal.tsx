// Modal "ver" de la vista de registros (Task 6): reconstruye el mismo HTML
// que se usa para el PDF (`buildRecordPdfHtml`) y lo muestra inline, sin
// convertirlo a PDF — una lectura rápida del registro guardado.

import { useEffect, useState } from "react";
import type { ConsentRecordDto } from "../../../services/api";
import { buildRecordPdfHtml } from "./consentRecordPdf";
import { sanitizeHtml } from "../../../utils/sanitize";
import Icon from "../../common/Icon";

type Props = {
  record: ConsentRecordDto;
  onClose: () => void;
};

export default function ConsentRecordViewModal({ record, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    buildRecordPdfHtml(record)
      .then((h) => {
        if (!cancelled) setHtml(h);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el registro");
      });
    return () => {
      cancelled = true;
    };
  }, [record]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <h2 className="m-0 min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {record.nombres} {record.apellidos ?? ""} · {record.tipoDoc} {record.numDoc}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}
          {!error && !html && (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Cargando…</div>
          )}
          {html && (
            <div
              className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
              // El HTML lo genera `buildConsentPdf` (mismo motor que arma el PDF
              // adjunto de los correos); igual se sanitiza antes de inyectarlo.
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
