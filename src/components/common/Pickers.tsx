const ACCENT = "#00c2a8";
const ACCENT_50 = "rgba(0, 194, 168, 0.10)";

type ColorOption = { id: string; label: string; value: string };
type IconOption = { id: string; label: string };

export function ColorPicker({
  selected,
  onChange,
  colors,
}: {
  selected: string;
  onChange: (v: string) => void;
  colors: ColorOption[];
}) {
  return (
    <div className="mb-4 flex gap-2">
      {colors.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.value)}
          title={c.label}
          className="h-8 w-8 cursor-pointer rounded-full"
          style={{
            background: c.value,
            border: selected === c.value ? "3px solid #111827" : "3px solid transparent",
          }}
        />
      ))}
    </div>
  );
}

export function IconPicker({
  selected,
  onChange,
  icons,
}: {
  selected: string;
  onChange: (v: string) => void;
  icons: IconOption[];
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {icons.map((ic) => (
        <button
          key={ic.id}
          onClick={() => onChange(ic.id)}
          title={ic.label}
          className="h-10 w-10 cursor-pointer rounded-lg text-xl"
          style={{
            border: selected === ic.id ? `2px solid ${ACCENT}` : "2px solid #e2e8f0",
            background: selected === ic.id ? ACCENT_50 : "#fff",
          }}
        >
          {ic.id}
        </button>
      ))}
    </div>
  );
}
