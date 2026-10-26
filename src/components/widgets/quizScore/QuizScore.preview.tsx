import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

export default function QuizScorePreview({ widget }: WidgetPreviewProps) {
  const showMax = (widget.config.showMax as boolean) ?? true;
  const decimals = (widget.config.decimalPrecision as number) ?? 1;
  const visibility = (widget.config.visibility as string) || "visible";
  const zeros = `0.${"0".repeat(decimals)}`;
  const hint = showMax ? `${zeros} / ${zeros}` : zeros;

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
      </label>
      <div
        style={{
          padding: "10px 14px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0891b2",
            fontFamily: "monospace",
          }}
        >
          {hint}
        </span>
        <Icon name="award" size={16} />
      </div>
      {visibility !== "visible" && (
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "4px 0 0",
            fontStyle: "italic",
          }}
        >
          {visibility === "hidden_to_user"
            ? "No visible para el usuario final"
            : "Solo visible al finalizar"}
        </p>
      )}
    </div>
  );
}
