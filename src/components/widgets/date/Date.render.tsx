import type { WidgetRenderProps } from "../../../types/widget.types";

export default function DateRender({ widget }: WidgetRenderProps) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="date"
        name={widget.id}
        required={widget.required}
        min={(widget.config.min as string) || undefined}
        max={(widget.config.max as string) || undefined}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}