import { useEffect } from 'react';

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  blobUrl: string | null;
  filename: string;
  headerInfo?: string;
  formName?: string;
  onClose: () => void;
  onDownload: () => void;
};

export default function PdfPreviewModal({
  open, loading, error, blobUrl, filename, headerInfo, formName, onClose, onDownload,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-[13.5px] font-bold text-slate-900">
              Vista previa · {formName ?? 'PDF'}
            </div>
            {headerInfo && (
              <div className="mt-0.5 text-[11.5px] text-slate-500">{headerInfo}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[22px] leading-none text-slate-500 hover:text-slate-800"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-200 p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-[13px] text-slate-600">
              Generando PDF…
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center text-[13px] text-red-700">
              {error}
            </div>
          )}
          {blobUrl && !loading && !error && (
            <iframe
              src={blobUrl}
              title={filename}
              className="h-full w-full rounded-md border-none bg-white"
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            🔒 Generado en el servidor · registrado en auditoría
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-300 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!blobUrl || loading}
              className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⬇ Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
