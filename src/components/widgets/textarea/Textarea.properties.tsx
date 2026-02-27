import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function TextareaProperties({ widget, updateWidget }: WidgetPropertiesProps) {
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
        <label style={labelStyle}>Placeholder</label>
        <input
          style={inputStyle}
          value={(widget.config.placeholder as string) || ""}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, placeholder: e.target.value },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Longitud máxima</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.maxLength as number) || 500}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, maxLength: parseInt(e.target.value) || 500 },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Filas</label>
        <input
          type="number"
          style={inputStyle}
          min={1}
          max={20}
          value={(widget.config.rows as number) || 4}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, rows: parseInt(e.target.value) || 4 },
            })
          }
        />
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
          checked={widget.required}
          onChange={(e) =>
            updateWidget(widget.id, { required: e.target.checked })
          }
        />
        <span>Campo obligatorio</span>
      </label>
    </>
  );
}
