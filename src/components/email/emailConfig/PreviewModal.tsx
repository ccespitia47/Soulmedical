type PreviewModalProps = {
  title: string;
  html: string;
  onClose: () => void;
};

export default function PreviewModal({ title, html, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-5">
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="m-0 text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-xl text-gray-400"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#f0f4f8] p-6">
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            className="rounded-lg bg-white"
          />
        </div>
        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-none bg-gray-500 px-6 py-2.5 text-sm font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
