import { labelCls } from "../sections/sharedUi";

type Props = {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
};

export default function PhotoField({ label, value, onChange }: Props) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className={labelCls} htmlFor="photo-field-input">
        {label}
      </label>
      <input
        id="photo-field-input"
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00c2a8]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0f766e] hover:file:bg-[#00c2a8]/20 dark:text-slate-200 dark:file:text-[#2dd4bf]"
      />
      {value && (
        <div className="mt-3">
          <img
            src={value}
            alt={label}
            className="max-h-48 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
          />
        </div>
      )}
    </div>
  );
}
