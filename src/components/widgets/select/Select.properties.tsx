import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function SelectProperties({ widget, updateWidget }: WidgetPropertiesProps) {
  const options = (widget.config.options as string[]) || [];

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

  const updateOptions = (newOptions: string[]) => {
    updateWidget(widget.id, {
      config: { ...widget.config, options: newOptions },
    });
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
        <label style={labelStyle}>Opciones</label>
        {options.map((option, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={option}
              onChange={(e) => {
                const newOptions = [...options];
                newOptions[index] = e.target.value;
                updateOptions(newOptions);
              }}
            />
            <button
              type="button"
              onClick={() => {
                const newOptions = options.filter((_, i) => i !== index);
                updateOptions(newOptions);
              }}
              style={{
                padding: "6px 10px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 6,
                backgroundColor: "#fff",
                color: "#ef4444",
                fontSize: 13,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => updateOptions([...options, `Opción ${options.length + 1}`])}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1.5px dashed #00c2a8",
            borderRadius: 6,
            backgroundColor: "transparent",
            color: "#00c2a8",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          + Agregar opción
        </button>
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
