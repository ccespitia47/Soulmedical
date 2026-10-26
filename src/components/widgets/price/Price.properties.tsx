import CurrencyPicker from "../../common/CurrencyPicker";
import type { WidgetPropertiesProps } from "../../../types/widget.types";

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
const CHECKBOX_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#111827",
  cursor: "pointer",
  marginBottom: 10,
};

const DECIMAL_MARKS = [
  { value: "comma", label: "Coma (9,95)" },
  { value: "point", label: "Punto (9.95)" },
];

export default function PriceProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

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

      {/* Moneda */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Moneda</label>
        <CurrencyPicker
          value={(cfg.currency as string) || "COP"}
          onChange={(code) => set({ currency: code })}
        />
      </div>

      {/* Marca decimal */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Marca decimal</label>
        <select
          style={INPUT}
          value={(cfg.decimalMark as string) || "comma"}
          onChange={(e) => set({ decimalMark: e.target.value })}
        >
          {DECIMAL_MARKS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Precisión decimal */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Precisión decimal</label>
        <input
          type="number"
          style={INPUT}
          min={0}
          max={6}
          value={(cfg.decimalPrecision as number) ?? 2}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            set({ decimalPrecision: Number.isFinite(n) ? n : 0 });
          }}
        />
      </div>

      {/* Cantidad mínima */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Cantidad mínima</label>
        <input
          type="number"
          style={INPUT}
          placeholder="Sin límite"
          value={(cfg.minAmount as string) || ""}
          onChange={(e) => set({ minAmount: e.target.value })}
        />
      </div>

      {/* Cantidad máxima */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Cantidad máxima</label>
        <input
          type="number"
          style={INPUT}
          placeholder="Sin límite"
          value={(cfg.maxAmount as string) || ""}
          onChange={(e) => set({ maxAmount: e.target.value })}
        />
      </div>

      {/* Obligatorio */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Obligatorio</span>
      </label>

      {/* Recordar entrada */}
      <label style={{ ...CHECKBOX_ROW, marginBottom: 0 }}>
        <input
          type="checkbox"
          checked={(cfg.rememberInput as boolean) ?? false}
          onChange={(e) => set({ rememberInput: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Recordar entrada</span>
      </label>
    </>
  );
}
