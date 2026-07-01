import { useRef } from "react";

type LogoUploaderProps = {
  customLogo: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
};

export default function LogoUploader({ customLogo, onUpload, onRemove }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen (PNG, JPG, SVG, etc.)");
      return;
    }
    onUpload(file);
  };

  return (
    <div className="border-b border-slate-100 bg-white px-3.5 py-3">
      <div className="mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-gray-700">
          🖼️ Logo / Imagen
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      {customLogo ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50 p-2">
          <img
            src={customLogo}
            alt="Logo"
            className="max-h-[52px] max-w-full object-contain"
          />
          <div className="flex w-full gap-1.5">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 cursor-pointer rounded-md border border-sky-200 bg-white py-1 text-[10px] font-semibold text-cyan-700"
            >
              🔄 Cambiar
            </button>
            <button
              onClick={onRemove}
              className="flex-1 cursor-pointer rounded-md border border-red-200 bg-white py-1 text-[10px] font-semibold text-red-500"
            >
              🗑️ Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-2 py-3.5 transition-colors hover:border-[#00c2a8] hover:bg-emerald-50"
        >
          <span className="text-[22px]">🖼️</span>
          <span className="text-[11px] font-semibold text-gray-700">Cargar imagen</span>
          <span className="text-[10px] text-gray-400">PNG, JPG, SVG</span>
        </button>
      )}
    </div>
  );
}
