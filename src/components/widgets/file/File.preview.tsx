import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

const TYPE_LABELS: Record<string, string> = {
  documents: "Documentos",
  images: "Imágenes",
  audio: "Audio",
  video: "Video",
};

export default function FilePreview({ widget }: WidgetPreviewProps) {
  const fileType = (widget.config.fileType as string) || "documents";
  const maxSizeMB = (widget.config.maxSizeMB as number) || 25;

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#111827",
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>
      <div
        style={{
          border: "1.5px dashed #e2e8f0",
          borderRadius: 8,
          padding: "16px 12px",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "#94a3b8",
        }}
      >
        <Icon name="file" size={18} />
        <span style={{ fontSize: 13 }}>Selecciona un archivo</span>
        <span
          style={{
            fontSize: 11,
            color: "#cbd5e1",
            fontFamily: "monospace",
          }}
        >
          · {TYPE_LABELS[fileType]} · máx. {maxSizeMB} MB
        </span>
      </div>
    </div>
  );
}
