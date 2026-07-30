import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function SearchPreview({ widget }: WidgetPreviewProps) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
      </label>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        border: "1.5px solid #e2e8f0", borderRadius: 6,
        padding: "8px 12px", background: "#fafafa",
      }}>
        <span style={{ fontSize: 14, color: "#9ca3af" }}>🔍</span>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          {(widget.config.placeholder as string) || "Buscar..."}
        </span>
      </div>
    </div>
  );
}