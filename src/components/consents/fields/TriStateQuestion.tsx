import { useId } from "react";
import type { TriStateQ } from "../config/entityConfig";

type Props = {
  q: TriStateQ;
  value: string; // "Sí" | "No" | q.thirdLabel | ""
  note: string;
  onChange: (v: string) => void;
  onNoteChange: (v: string) => void;
};

export default function TriStateQuestion({ q, value, note, onChange, onNoteChange }: Props) {
  const options = ["Sí", "No", q.thirdLabel];
  // El marco de Consientify puede tener dos formularios montados a la vez: uno
  // a medias en Consentimientos y otro abierto en edición desde Registros. Con
  // `name={q.id}` el navegador los trataría como UN solo grupo de radios, así
  // que marcar en uno desmarcaría en el DOM el del otro; al ser inputs
  // controlados, React no restaura el `checked`. Se vería una pregunta en
  // blanco y se firmaría como respondida.
  const grupo = `${useId()}-${q.id}`;
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p className="m-0 text-[13px] leading-snug text-slate-700 dark:text-slate-200">
          <span className="mr-1 font-semibold text-[#0f766e] dark:text-[#2dd4bf]">{q.num}.</span>
          {q.text}
          {q.required && <span className="ml-0.5 text-red-500">*</span>}
        </p>
        <div className="flex shrink-0 gap-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-[12px] text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name={grupo}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-3.5 w-3.5 accent-[#00c2a8]"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
      {q.note && (
        <div className="mt-2">
          <label className="mb-1 block text-[12px] text-slate-500 dark:text-slate-400">{q.note.label}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}
    </div>
  );
}
