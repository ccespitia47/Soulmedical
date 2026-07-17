import type { ConsentField } from "../config/entityConfig";

export const labelCls =
  "mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200";
export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
export const cardCls =
  "mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
export const sectionTitleCls =
  "m-0 mb-4 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf]";

export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ConsentField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecciona…</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type === "number" ? "number" : field.type}
      className={inputCls}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FieldGrid({
  fields,
  values,
  setValue,
}: {
  fields: ConsentField[];
  values: Record<string, string>;
  setValue: (id: string, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.id} className={f.half ? "" : "sm:col-span-2"}>
          <label className={labelCls}>
            {f.label}
            {f.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          <FieldControl field={f} value={values[f.id] ?? ""} onChange={(v) => setValue(f.id, v)} />
        </div>
      ))}
    </div>
  );
}
