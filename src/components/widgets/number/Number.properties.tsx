import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function NumberProperties({ widget, updateWidget }: WidgetPropertiesProps) {
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
        <label style={labelStyle}>Valor mínimo</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.min as number) ?? 0}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, min: parseFloat(e.target.value) || 0 },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Valor máximo</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.max as number) ?? 999999}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, max: parseFloat(e.target.value) || 999999 },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Incremento (step)</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.step as number) ?? 1}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, step: parseFloat(e.target.value) || 1 },
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
          marginBottom: 12,
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
          checked={(widget.config.allowDecimals as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, allowDecimals: e.target.checked },
            })
          }
        />
        <span>Permitir decimales</span>
      </label>
    </>
  );
}
