import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function SignatureProperties({ widget, updateWidget }: WidgetPropertiesProps) {
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
        <label style={labelStyle}>Color del trazo</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={(widget.config.penColor as string) || "#000000"}
            onChange={(e) =>
              updateWidget(widget.id, {
                config: { ...widget.config, penColor: e.target.value },
              })
            }
            style={{
              width: 36,
              height: 36,
              padding: 2,
              border: "1.5px solid #e2e8f0",
              borderRadius: 6,
              cursor: "pointer",
              backgroundColor: "#fafafa",
            }}
          />
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            {(widget.config.penColor as string) || "#000000"}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Grosor del trazo</label>
        <input
          type="number"
          min={1}
          max={5}
          style={inputStyle}
          value={(widget.config.penWidth as number) || 2}
          onChange={(e) => {
            let val = parseInt(e.target.value) || 2;
            if (val < 1) val = 1;
            if (val > 5) val = 5;
            updateWidget(widget.id, {
              config: { ...widget.config, penWidth: val },
            });
          }}
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
