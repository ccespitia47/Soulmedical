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

export default function TimeProperties({
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

      {/* Ahora por defecto */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={(cfg.nowByDefault as boolean) ?? false}
          onChange={(e) => set({ nowByDefault: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Ahora por defecto</span>
      </label>

      {/* Obligatorio */}
      <label style={CHECKBOX_ROW}>
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) =>
            updateWidget(widget.id, { required: e.target.checked })
          }
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
