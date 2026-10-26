import Icon from "../common/Icon";

type FormHeaderProps = {
  formName: string;
  onClose?: () => void;
};

export default function FormHeader({ formName, onClose }: FormHeaderProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_6px_16px_-6px_rgba(8,145,178,0.6)]">
          <Icon name="clipboard" size={19} strokeWidth={2} />
        </span>
        <div>
          <h1 className="m-0 text-[15px] font-bold tracking-tight text-gray-900">{formName}</h1>
          <p className="m-0 mt-0.5 text-[11px] font-medium text-gray-400">Diligenciar formulario</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-600 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#00c2a8] hover:text-[#0891b2] hover:shadow-[0_6px_16px_-8px_rgba(8,145,178,0.5)]"
        >
          <span className="text-base leading-none">←</span> Volver
        </button>
      )}
    </header>
  );
}
