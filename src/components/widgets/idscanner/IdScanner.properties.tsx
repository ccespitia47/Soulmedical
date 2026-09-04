import type { WidgetPropertiesProps } from "../../../types/widget.types";

const ALL_FIELDS = [
  { key: "nombre", label: "Nombre completo" },
  { key: "numero", label: "Número de documento" },
  { key: "fechaNacimiento", label: "Fecha de nacimiento" },
  { key: "sexo", label: "Sexo" },
  { key: "fechaExpedicion", label: "Fecha de expedición" },
  { key: "lugarExpedicion", label: "Lugar de expedición" },
];

export default function IdScannerProperties({ widget, updateWidget }: WidgetPropertiesProps) {
  const selectedFields = (widget.config.fields as string[]) || ["nombre", "numero", "fechaNacimiento"];

  const toggleField = (key: string) => {
    const next = selectedFields.includes(key)
      ? selectedFields.filter((f) => f !== key)
      : [...selectedFields, key];
    updateWidget(widget.id, { config: { ...widget.config, fields: next } });
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px",
    border: "1.5px solid #e2e8f0", borderRadius: 6,
    fontSize: 13.5, fontFamily: "inherit",
    backgroundColor: "#fafafa", color: "#111827",
    boxSizing: "border-box" as const, outline: "none",
  };

  const labelStyle = {
    display: "block", fontSize: 11.5,
    fontWeight: 600 as const, color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em", marginBottom: 5,
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Etiqueta</label>
        <input style={inputStyle} value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Campos a extraer</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ALL_FIELDS.map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox"
                checked={selectedFields.includes(key)}
                onChange={() => toggleField(key)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
        <input type="checkbox"
          checked={(widget.config.allowManual as boolean) ?? true}
          onChange={(e) => updateWidget(widget.id, {
            config: { ...widget.config, allowManual: e.target.checked },
          })} />
        <span>Permitir edición manual</span>
      </label>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Tipo de documento</label>
        <select
          style={inputStyle}
          value={(widget.config.documentType as string) || "auto"}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, documentType: e.target.value },
            })
          }
        >
          <option value="auto">Detectar automáticamente</option>
          <option value="cc">Cédula de Ciudadanía (Colombia)</option>
          <option value="ce">Cédula de Extranjería (Colombia)</option>
          <option value="ti">Tarjeta de Identidad (menores)</option>
          <option value="passport">Pasaporte / Internacional</option>
        </select>
      </div>

      <div style={{
        padding: "10px 12px", background: "#fffbeb",
        border: "1px solid #fde68a", borderRadius: 6,
        fontSize: 12, color: "#92400e", lineHeight: 1.5,
      }}>
        💡 Usa Tesseract.js (OCR gratuito). Para mayor precisión puedes migrar a Google Vision API en el futuro.
      </div>
    </>
  );
}