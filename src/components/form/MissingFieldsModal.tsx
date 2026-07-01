type MissingFieldsModalProps = {
  fields: string[];
  onClose: () => void;
};

export default function MissingFieldsModal({ fields, onClose }: MissingFieldsModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[480px] rounded-[20px] bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="m-0 mb-2.5 text-xl font-bold text-gray-900">
          Campos obligatorios faltantes
        </h2>
        <p className="m-0 mb-[18px] text-[13px] leading-relaxed text-gray-500">
          Por favor completa los siguientes campos:
        </p>
        <div className="mb-5 rounded-[10px] border-[1.5px] border-red-200 bg-red-50 px-[18px] py-3.5 text-left">
          <ul className="m-0 pl-[18px] text-[13px] leading-[1.8] text-red-900">
            {fields.map((f, i) => (
              <li key={i} className="font-semibold">
                {f}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={onClose}
          className="w-full cursor-pointer rounded-[10px] border-none bg-red-500 px-8 py-[11px] text-sm font-semibold text-white"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
