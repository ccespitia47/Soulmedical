import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")} min` : `${s}s`;
}

export default function VideoPreview({ widget }: WidgetPreviewProps) {
  const maxDurationSecs = (widget.config.maxDurationSecs as number) || 60;
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
          padding: "22px 12px",
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: "#94a3b8",
        }}
      >
        <span style={{ color: "#0891b2" }}>
          <Icon name="video" size={28} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Añadir video</span>
        <span
          style={{
            fontSize: 11,
            color: "#cbd5e1",
            fontFamily: "monospace",
          }}
        >
          máx. {formatDuration(maxDurationSecs)}
        </span>
      </div>
    </div>
  );
}
