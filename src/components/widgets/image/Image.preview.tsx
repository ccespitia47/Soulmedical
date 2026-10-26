import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function ImagePreview({ widget }: WidgetPreviewProps) {
  const src = widget.config.src as string;
  const maxWidth = (widget.config.maxWidth as number) || 180;
  const maxHeight = (widget.config.maxHeight as number | null) ?? undefined;

  return (
    <div style={{ textAlign: "center" }}>
      {src ? (
        <img
          src={src}
          alt={widget.label || "Imagen"}
          style={{
            width: "100%",
            maxWidth,
            maxHeight,
            height: "auto",
            objectFit: "contain",
            display: "block",
            margin: "0 auto",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth,
            height: 80,
            margin: "0 auto",
            border: "2px dashed #e2e8f0",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#94a3b8",
            background: "#f8fafc",
          }}
        >
          <Icon name="image" size={26} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Imagen</span>
        </div>
      )}
      {widget.label && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          {widget.label}
        </div>
      )}
    </div>
  );
}
