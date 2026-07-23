import type { SubformField } from "../subform.types";

const INPUT_BASE =
  "box-border w-full rounded-[7px] border-[1.5px] border-slate-200 bg-neutral-50 px-3 py-2.5 font-sans text-[13.5px] text-gray-900 outline-none focus:border-[#00c2a8]";

type FieldInputProps = {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
};

export default function FieldInput({ field, value, onChange }: FieldInputProps) {
  if (field.type === "textarea") {
    return (
      <textarea
        name={field.id}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`${INPUT_BASE} resize-y`}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        name={field.id}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_BASE} cursor-pointer`}
      >
        <option value="">-- Selecciona --</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="flex flex-col gap-1.5">
        {(field.options || []).map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-[13px]"
          >
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    let selected: string[] = [];
    try {
      selected = value ? JSON.parse(value) : [];
    } catch {
      selected = [];
    }
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((x) => x !== opt)
        : [...selected, opt];
      onChange(JSON.stringify(next));
    };
    return (
      <div className="flex flex-col gap-1.5">
        {(field.options || []).map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-[13px]"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  // text / number / email / phone / date
  const typeMap: Record<string, string> = {
    text: "text",
    number: "number",
    email: "email",
    phone: "tel",
    date: "date",
  };

  return (
    <input
      type={typeMap[field.type] || "text"}
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_BASE}
    />
  );
}
