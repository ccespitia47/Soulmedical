import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function TextProperties({ widget, updateWidget }: WidgetPropertiesProps) {
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
        <label style={labelStyle}>Valor por defecto</label>
        <input
          style={inputStyle}
          value={(widget.config.defaultValue as string) || ""}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, defaultValue: e.target.value },
            })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Longitud máxima</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.maxLength as number) || 100}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, maxLength: parseInt(e.target.value) || 100 },
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
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={(widget.config.allowNumbers as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, allowNumbers: e.target.checked },
            })
          }
        />
        <span>Permitir números</span>
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
          checked={(widget.config.allowSpecialChars as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, allowSpecialChars: e.target.checked },
            })
          }
        />
        <span>Permitir caracteres especiales</span>
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
          marginTop: 12,
        }}
      >
        <input
          type="checkbox"
          checked={(widget.config.allowLineBreaks as boolean) || false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, allowLineBreaks: e.target.checked },
            })
          }
        />
        <span>Permitir salto de línea</span>
      </label>
    </>
  );
}