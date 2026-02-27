import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function CheckboxPreview({ widget }: WidgetPreviewProps) {
  const options = (widget.config.options as string[]) || [];

  return (
    <div style={{ padding: "12px" }}>
      <label style={{
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 6,
      }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((option, index) => (
          <label
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: "#9ca3af",
              cursor: "not-allowed",
            }}
          >
            <input
              type="checkbox"
              disabled
              style={{ cursor: "not-allowed" }}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
