import type { WidgetPreviewProps } from "../../../types/widget.types";

const sizeMap: Record<string, number> = {
  small: 14,
  medium: 18,
  large: 24,
};

export default function HeaderPreview({ widget }: WidgetPreviewProps) {
  const text = (widget.config.text as string) || "Sección";
  const size = (widget.config.size as string) || "medium";
  const showDivider = widget.config.showDivider as boolean;
  const fontSize = sizeMap[size] || 18;

  return (
    <div style={{ padding: "12px" }}>
      <div
        style={{
          fontSize,
          fontWeight: 600,
          color: "#111827",
          marginBottom: showDivider ? 8 : 0,
        }}
      >
        {text}
      </div>
      {showDivider && (
        <div
          style={{
            borderBottom: "1px solid #e2e8f0",
          }}
        />
      )}
    </div>
  );
}
