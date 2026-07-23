import type { WidgetPreviewProps } from "../../../types/widget.types";
import { sanitizeHtml } from "../../../utils/sanitize";

export default function HtmlBlockPreview({ widget }: WidgetPreviewProps) {
  const html = (widget.config.html as string) || "";

  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 6,
        padding: "8px 10px",
        background: "#fafafa",
        minHeight: 36,
        fontSize: 12,
        color: "#6b7280",
        overflow: "hidden",
      }}
    >
      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
          style={{ pointerEvents: "none", fontSize: 11 }}
        />
      ) : (
        <span style={{ fontStyle: "italic" }}>Bloque HTML vacío</span>
      )}
    </div>
  );
}