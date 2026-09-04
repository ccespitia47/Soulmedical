import type { WidgetPreviewProps } from "../../../types/widget.types";
import { findCountry } from "../../../lib/countries";

export default function PhonePreview({ widget }: WidgetPreviewProps) {
  const enableSelector = (widget.config.enableCountrySelector as boolean) || false;
  const defaultCode = (widget.config.defaultCountry as string) || "CO";
  const country = findCountry(defaultCode);
  const legacyPrefix = (widget.config.prefix as string) || "+57";
  const placeholder = (widget.config.placeholder as string) ||
    (enableSelector ? country.placeholder : "300 123 4567");

  return (
    <div style={{ padding: "12px" }}>
      <label style={{
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "#111827",
        marginBottom: 6,
      }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span
          style={{
            padding: "8px 10px",
            border: "1.5px solid #e2e8f0",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            fontSize: 13.5,
            backgroundColor: "#f1f5f9",
            color: "#111827",
            fontWeight: 500,
            lineHeight: "1.5",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {enableSelector ? (
            <>
              <span style={{ fontSize: 16 }}>{country.flag}</span>
              <span>{country.dialCode}</span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>▾</span>
            </>
          ) : (
            legacyPrefix
          )}
        </span>
        <input
          type="tel"
          disabled
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            backgroundColor: "#f9fafb",
            color: "#9ca3af",
            cursor: "not-allowed",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
