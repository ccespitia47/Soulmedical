import Icon from "../../common/Icon";
import type { WidgetPreviewProps } from "../../../types/widget.types";

const OPERATOR_LABELS: Record<string, string> = {
  sum: "Suma (+)",
  subtract: "Resta (−)",
  multiply: "Multiplicar (×)",
  divide: "Dividir (÷)",
  average: "Promedio",
  min: "Mínimo",
  max: "Máximo",
  count: "Contar",
};

export default function CalcPreview({ widget }: WidgetPreviewProps) {
  const operator = (widget.config.operator as string) || "sum";
  const isPrice = widget.config.isPrice as boolean;
  const currency = (widget.config.currency as string) || "COP";
  const decimals = (widget.config.decimalPrecision as number) ?? 2;
  const hint = `= 0.${"0".repeat(decimals)}`;

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111827" }}>
        {widget.label}
      </label>
      <div
        style={{
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {OPERATOR_LABELS[operator] || operator}
          {isPrice && (
            <span style={{ marginLeft: 6, color: "#0891b2", fontWeight: 600 }}>
              · {currency}
            </span>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#d1d5db", fontFamily: "monospace" }}>
            {hint}
          </span>
          <Icon name="calc" size={15} />
        </div>
      </div>
    </div>
  );
}
