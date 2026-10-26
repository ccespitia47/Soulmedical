import type { WidgetPreviewProps } from "../../../types/widget.types";
import { getCurrencySymbol } from "../../../lib/currencies";

export default function PricePreview({ widget }: WidgetPreviewProps) {
  const cfg = widget.config;
  const currency = (cfg.currency as string) || "COP";
  const decimalMark = (cfg.decimalMark as string) || "comma";
  const decimalPrecision = (cfg.decimalPrecision as number) ?? 2;
  const symbol = getCurrencySymbol(currency);
  const zero = decimalMark === "comma"
    ? `0,${"0".repeat(decimalPrecision)}`
    : `0.${"0".repeat(decimalPrecision)}`;

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
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          overflow: "hidden",
          background: "#f8fafc",
        }}
      >
        <span
          style={{
            padding: "8px 10px",
            background: "#f1f5f9",
            borderRight: "1px solid #e2e8f0",
            fontSize: 14,
            fontWeight: 700,
            color: "#0891b2",
            fontFamily: "monospace",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {symbol}
        </span>
        <span
          style={{
            padding: "8px 12px",
            fontSize: 13,
            color: "#9ca3af",
            flex: 1,
          }}
        >
          {zero}
        </span>
        <span
          style={{
            padding: "8px 10px",
            fontSize: 11,
            color: "#94a3b8",
            fontFamily: "monospace",
          }}
        >
          {currency}
        </span>
      </div>
    </div>
  );
}
