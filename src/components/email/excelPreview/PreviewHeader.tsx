type PreviewHeaderProps = {
  hasFormValues: boolean;
  exporting: boolean;
  loading: boolean;
  onExportPdf: () => void;
  onClose: () => void;
};

export default function PreviewHeader({
  hasFormValues,
  exporting,
  loading,
  onExportPdf,
  onClose,
}: PreviewHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-amber-500 to-red-500 text-lg">
          📄
        </div>
        <div>
          <h2 className="m-0 text-base font-bold text-slate-900">Vista Previa del PDF</h2>
          <p className="m-0 text-[11px] text-slate-500">
            {hasFormValues
              ? "Datos reales del formulario"
              : "Los valores entre [ ] son de ejemplo — así se verá al enviar"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onExportPdf}
          disabled={exporting || loading}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-semibold text-white transition-all disabled:cursor-not-allowed"
          style={{
            background: exporting
              ? "#94a3b8"
              : "linear-gradient(135deg, #ef4444, #dc2626)",
            boxShadow: exporting ? "none" : "0 2px 8px rgba(239,68,68,0.35)",
          }}
        >
          {exporting ? "⏳ Generando..." : "⬇️ Descargar PDF"}
        </button>
        <button
          onClick={onClose}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-base text-slate-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
