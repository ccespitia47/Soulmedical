type FormHeaderProps = {
  formName: string;
  onClose?: () => void;
};

export default function FormHeader({ formName, onClose }: FormHeaderProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-3">
        <span className="text-[22px]">📋</span>
        <div>
          <h1 className="m-0 text-[15px] font-bold text-gray-900">{formName}</h1>
          <p className="m-0 text-[11px] text-gray-400">Diligenciar formulario</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-1.5 text-[13px] font-semibold text-gray-500"
        >
          ← Volver
        </button>
      )}
    </header>
  );
}
