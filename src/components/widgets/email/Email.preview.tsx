import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function EmailPreview({ widget }: WidgetPreviewProps) {
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
      <input
        type="email"
        disabled
        placeholder={(widget.config.placeholder as string) || "correo@ejemplo.com"}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          backgroundColor: "#f9fafb",
          color: "#9ca3af",
          cursor: "not-allowed",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
