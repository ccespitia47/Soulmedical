import type { WidgetRenderProps } from "../../../types/widget.types";

export default function TextareaRender({ widget }: WidgetRenderProps) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <textarea
        required={widget.required}
        placeholder={(widget.config.placeholder as string) || ""}
        maxLength={(widget.config.maxLength as number) || undefined}
        rows={(widget.config.rows as number) || 4}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
    </div>
  );
}
