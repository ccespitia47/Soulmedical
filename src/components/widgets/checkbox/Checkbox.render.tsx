import type { WidgetRenderProps } from "../../../types/widget.types";

export default function CheckboxRender({ widget, hiddenWidgetIds }: WidgetRenderProps) {
  const rawOptions = (widget.config.options as string[]) || [];
  // Oculta opciones individuales marcadas por reglas vía ID compuesto
  // `${widget.id}::${opt}` (coincide con lo que escribe RuleTargetSelector).
  const options = hiddenWidgetIds
    ? rawOptions.filter((opt) => !hiddenWidgetIds.has(`${widget.id}::${opt}`))
    : rawOptions;

  // El prefill puede llegar como CSV ("a,b,c") o como string único.
  const raw = (widget.config.defaultValue as string) || "";
  const selected = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((option, index) => (
          <label
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: "#111827",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name={widget.id}
              value={option}
              defaultChecked={selected.has(option)}
              style={{ accentColor: "#00c2a8" }}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
