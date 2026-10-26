import type { WidgetPropertiesProps } from "../../../types/widget.types";
import { ID_DOC_COUNTRIES, ID_DOC_COUNTRY_MAP } from "../../../lib/idDocuments";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#f8fafc",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};
const COUNTRY_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 12.5,
  color: "#111827",
  cursor: "pointer",
};

export default function IdDocumentProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const countries = (cfg.countries as string[]) || ["CO"];
  const defaultCountry = (cfg.defaultCountry as string) || countries[0];
  const thousandsSeparator = (cfg.thousandsSeparator as string) || "none";

  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  const toggleCountry = (code: string) => {
    const next = countries.includes(code)
      ? countries.filter((c) => c !== code)
      : [...countries, code];
    // Nunca dejamos vacío — al menos un país activo.
    if (next.length === 0) return;
    // Si el default quedó fuera, movemos al primero disponible.
    const nextDefault = next.includes(defaultCountry) ? defaultCountry : next[0];
    set({ countries: next, defaultCountry: nextDefault });
  };

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Países habilitados */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Países disponibles</label>
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {ID_DOC_COUNTRIES.map((c) => {
            const active = countries.includes(c.code);
            return (
              <label
                key={c.code}
                style={{
                  ...COUNTRY_ROW,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleCountry(c.code)}
                  style={{ accentColor: "#0891b2" }}
                />
                <span style={{ fontSize: 15 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "#94a3b8",
                    fontFamily: "monospace",
                  }}
                >
                  {c.types.length} tipos
                </span>
              </label>
            );
          })}
        </div>
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "6px 0 0",
            lineHeight: 1.4,
          }}
        >
          Con un solo país activo, el usuario no ve el selector de país.
        </p>
      </div>

      {/* País por defecto (solo si hay > 1) */}
      {countries.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>País por defecto</label>
          <select
            style={INPUT}
            value={defaultCountry}
            onChange={(e) => set({ defaultCountry: e.target.value })}
          >
            {countries.map((code) => {
              const c = ID_DOC_COUNTRY_MAP[code];
              return c ? (
                <option key={code} value={code}>
                  {c.flag} {c.name}
                </option>
              ) : null;
            })}
          </select>
        </div>
      )}

      {/* Separador de miles */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Separador de miles (números)</label>
        <select
          style={INPUT}
          value={thousandsSeparator}
          onChange={(e) => set({ thousandsSeparator: e.target.value })}
        >
          <option value="none">Sin separador</option>
          <option value="dot">Punto (1.015.437.174)</option>
          <option value="comma">Coma (1,015,437,174)</option>
        </select>
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "6px 0 0",
            lineHeight: 1.4,
          }}
        >
          Solo aplica a tipos de documento numéricos (cédula, DNI…). En la
          base de datos el número se guarda sin separadores.
        </p>
      </div>

      {/* Obligatorio */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Obligatorio</span>
      </label>
    </>
  );
}
