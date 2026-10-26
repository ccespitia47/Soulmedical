import { useEffect, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import { getCurrencySymbol } from "../../../lib/currencies";

const STORAGE_KEY = (widgetId: string) => `soulforms_price_${widgetId}`;

export default function PriceRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const currency = (cfg.currency as string) || "COP";
  const decimalMark = (cfg.decimalMark as string) || "comma";
  const decimalPrecision = (cfg.decimalPrecision as number) ?? 2;
  const minAmount = cfg.minAmount
    ? parseFloat(cfg.minAmount as string)
    : undefined;
  const maxAmount = cfg.maxAmount
    ? parseFloat(cfg.maxAmount as string)
    : undefined;
  const rememberInput = (cfg.rememberInput as boolean) ?? false;
  const symbol = getCurrencySymbol(currency);

  const [rawValue, setRawValue] = useState(() => {
    if (rememberInput) {
      return localStorage.getItem(STORAGE_KEY(widget.id)) ?? "";
    }
    return "";
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (rememberInput && rawValue) {
      localStorage.setItem(STORAGE_KEY(widget.id), rawValue);
    }
  }, [rawValue, rememberInput, widget.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (decimalMark === "comma") {
      val = val.replace(/[^0-9,]/g, "");
    } else {
      val = val.replace(/[^0-9.]/g, "");
    }
    setRawValue(val);
    setError("");

    const num = parseFloat(val.replace(",", "."));
    if (!Number.isNaN(num)) {
      if (minAmount !== undefined && num < minAmount) {
        setError(`El valor mínimo es ${symbol} ${minAmount}`);
      } else if (maxAmount !== undefined && num > maxAmount) {
        setError(`El valor máximo es ${symbol} ${maxAmount}`);
      }
    }
  };

  // Normalizamos al submit con punto decimal (parseable por el backend).
  const numericValue = rawValue.replace(",", ".");
  const placeholder =
    decimalMark === "comma"
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

      <input type="hidden" name={widget.id} value={numericValue} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1.5px solid ${error ? "#ef4444" : "#e2e8f0"}`,
          borderRadius: 7,
          overflow: "hidden",
          background: "white",
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
            flexShrink: 0,
            fontFamily: "monospace",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={rawValue}
          onChange={handleChange}
          required={widget.required}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            fontSize: 13.5,
            fontFamily: "inherit",
            outline: "none",
            background: "white",
            color: "#111827",
            minWidth: 0,
          }}
        />
        <span
          style={{
            padding: "8px 10px",
            fontSize: 11,
            color: "#94a3b8",
            flexShrink: 0,
            fontFamily: "monospace",
          }}
        >
          {currency}
        </span>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", margin: "5px 0 0" }}>
          {error}
        </p>
      )}
      {(minAmount !== undefined || maxAmount !== undefined) && !error && (
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
          {minAmount !== undefined && `Mín: ${symbol} ${minAmount}`}
          {minAmount !== undefined && maxAmount !== undefined && " · "}
          {maxAmount !== undefined && `Máx: ${symbol} ${maxAmount}`}
        </p>
      )}
    </div>
  );
}
