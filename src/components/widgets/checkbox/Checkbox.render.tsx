import type { WidgetRenderProps } from "../../../types/widget.types";

export default function CheckboxRender({ widget }: WidgetRenderProps) {
  const options = (widget.config.options as string[]) || [];

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
              style={{ accentColor: "#00c2a8" }}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
