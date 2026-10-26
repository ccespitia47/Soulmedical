import type { WidgetPreviewProps } from "../../../types/widget.types";
import { ID_DOC_COUNTRY_MAP } from "../../../lib/idDocuments";

export default function IdDocumentPreview({ widget }: WidgetPreviewProps) {
  const countries = (widget.config.countries as string[]) || ["CO"];
  const defaultCountry = (widget.config.defaultCountry as string) || countries[0];
  const country = ID_DOC_COUNTRY_MAP[defaultCountry];
  const firstType = country?.types[0];

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
          gap: 6,
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          background: "#f8fafc",
          padding: "6px 10px",
        }}
      >
        {countries.length > 1 && country && (
          <span style={{ fontSize: 14 }}>{country.flag}</span>
        )}
        {firstType && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0891b2",
              padding: "2px 6px",
              background: "#ecfeff",
              borderRadius: 4,
            }}
          >
            {firstType.code}
          </span>
        )}
        <span
          style={{
            fontSize: 12,
            color: "#94a3b8",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {firstType?.placeholder ?? "Número de documento"}
        </span>
      </div>
    </div>
  );
}
