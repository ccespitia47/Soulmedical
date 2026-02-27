import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function PhonePreview({ widget }: WidgetPreviewProps) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span
          style={{
            padding: "8px 10px",
            border: "1.5px solid #e2e8f0",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            fontSize: 13.5,
            backgroundColor: "#f1f5f9",
            color: "#111827",
            fontWeight: 500,
            lineHeight: "1.5",
          }}
        >
          {(widget.config.prefix as string) || "+57"}
        </span>
        <input
          type="tel"
          disabled
          placeholder={(widget.config.placeholder as string) || "300 123 4567"}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            backgroundColor: "#f9fafb",
            color: "#9ca3af",
            cursor: "not-allowed",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
