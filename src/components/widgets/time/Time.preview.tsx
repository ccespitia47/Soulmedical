import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function TimePreview({ widget }: WidgetPreviewProps) {
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
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 13px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 11,
          background: "#f8fafc",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: 9,
            background: "#e6f7f4",
            color: "#0891b2",
          }}
        >
          <Icon name="clock" size={16} />
        </span>
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "#9ca3af",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}
        >
          --:--
        </span>
      </div>
    </div>
  );
}
