import type { ConditionsGroup } from "../config/entityConfig";

type Props = {
  group: ConditionsGroup;
  /** Valor serializado "Opción A; Opción B". */
  value: string;
  onChange: (next: string) => void;
};

const SEP = "; ";

export default function CheckboxGroupField({ group, value, onChange }: Props) {
  const selected = new Set(value ? value.split(SEP) : []);

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    // Conserva el orden de group.options para salida estable.
    const ordered = group.options.filter((o) => next.has(o));
    onChange(ordered.join(SEP));
  };

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {group.label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200"
          >
            <input
              type="checkbox"
              checked={selected.has(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 accent-[#00c2a8]"
            />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
