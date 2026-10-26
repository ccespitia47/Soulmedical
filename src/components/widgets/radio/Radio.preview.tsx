import type { WidgetPreviewProps } from "../../../types/widget.types";
import { normalizeRadioOptions } from "./radioOptions";

export default function RadioPreview({ widget }: WidgetPreviewProps) {
  const cfg = widget.config;
  const options = normalizeRadioOptions(cfg.options);
  const useImageLabels = (cfg.useImageLabels as boolean) ?? false;
  const verticalAlign = (cfg.verticalAlign as boolean) ?? true;

  return (
    <div style={{ padding: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>
      <div
        style={{
          display: verticalAlign ? "flex" : "grid",
          flexDirection: verticalAlign ? "column" : undefined,
          gridTemplateColumns: verticalAlign
            ? undefined
            : "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 6,
        }}
      >
        {options.slice(0, 4).map((opt) => (
          <label
            key={opt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#9ca3af",
              cursor: "not-allowed",
            }}
          >
            <input
              type="radio"
              disabled
              name={`preview-${widget.id}`}
              style={{ accentColor: "#0891b2", cursor: "not-allowed" }}
            />
            {useImageLabels && opt.imageUrl && (
              <img
                src={opt.imageUrl}
                alt=""
                style={{
                  width: 24,
                  height: 24,
                  objectFit: "contain",
                  borderRadius: 4,
                  border: "1px solid #e2e8f0",
                }}
              />
            )}
            <span>{opt.label}</span>
          </label>
        ))}
        {options.length > 4 && (
          <span
            style={{
              fontSize: 11,
              color: "#94a3b8",
              paddingLeft: 22,
            }}
          >
            +{options.length - 4} más
          </span>
        )}
      </div>
    </div>
  );
}
