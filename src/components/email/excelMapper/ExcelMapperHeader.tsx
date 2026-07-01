type ExcelMapperHeaderProps = {
  onClose: () => void;
};

export default function ExcelMapperHeader({ onClose }: ExcelMapperHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-slate-50 to-emerald-50 px-6 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-lg">
          📊
        </div>
        <div>
          <h2 className="m-0 text-base font-bold text-slate-900">Mapear Campos en el Excel</h2>
          <p className="m-0 text-[11px] text-slate-500">
            Selecciona un campo → haz clic en la celda donde debe aparecer el valor
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-base text-slate-500"
      >
        ✕
      </button>
    </div>
  );
}
