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

export default function VideoProperties({
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

      {/* Duración máxima */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Duración máxima (segundos)</label>
        <input
          type="number"
          style={INPUT}
          min={5}
          max={1800}
          value={(cfg.maxDurationSecs as number) || 60}
          onChange={(e) =>
            set({ maxDurationSecs: parseInt(e.target.value) || 60 })
          }
        />
      </div>

      {/* Tamaño máximo */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Tamaño máximo (MB)</label>
        <input
          type="number"
          style={INPUT}
          min={5}
          max={200}
          value={(cfg.maxSizeMB as number) || 100}
          onChange={(e) => set({ maxSizeMB: parseInt(e.target.value) || 100 })}
        />
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "5px 0 0",
            lineHeight: 1.4,
          }}
        >
          Cap absoluto del servidor: 200 MB.
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
