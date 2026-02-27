import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function HeaderProperties({ widget, updateWidget }: WidgetPropertiesProps) {
  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 13.5,
    fontFamily: "inherit",
    backgroundColor: "#fafafa",
    color: "#111827",
    boxSizing: "border-box" as const,
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600 as const,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 5,
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Etiqueta</label>
        <input
          style={inputStyle}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Texto</label>
        <input
          style={inputStyle}
          value={(widget.config.text as string) || ""}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, text: e.target.value },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Tamaño</label>
        <select
          style={inputStyle}
          value={(widget.config.size as string) || "medium"}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, size: e.target.value },
            })
          }
        >
          <option value="small">Pequeño (14px)</option>
          <option value="medium">Mediano (18px)</option>
          <option value="large">Grande (24px)</option>
        </select>
      </div>

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
          checked={(widget.config.showDivider as boolean) ?? true}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, showDivider: e.target.checked },
            })
          }
        />
        <span>Mostrar divisor</span>
      </label>
    </>
  );
}
