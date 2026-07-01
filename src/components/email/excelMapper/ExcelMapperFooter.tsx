type ExcelMapperFooterProps = {
  mappingCount: number;
  hasCustomLogo: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export default function ExcelMapperFooter({
  mappingCount,
  hasCustomLogo,
  onCancel,
  onSave,
}: ExcelMapperFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {mappingCount > 0 ? (
          <span className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            ✅ {mappingCount} campo{mappingCount !== 1 ? "s" : ""} mapeado
            {mappingCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-slate-400">Ningún campo mapeado aún</span>
        )}
        {hasCustomLogo && (
          <span className="rounded-[20px] border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
            🖼️ Logo personalizado
          </span>
        )}
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-5 py-2 text-[13px] font-semibold text-slate-500"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          className="cursor-pointer rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(0,194,168,0.35)]"
        >
          💾 Guardar Mapeo ({mappingCount} campos)
        </button>
      </div>
    </div>
  );
}
