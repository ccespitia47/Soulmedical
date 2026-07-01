import type { WidgetPropertiesProps } from "../../../types/widget.types";

export default function HtmlBlockProperties({ widget, updateWidget }: WidgetPropertiesProps) {
  const html = (widget.config.html as string) ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Label del widget */}
      <div>
        <label style={labelStyle}>Etiqueta interna</label>
        <input
          style={inputStyle}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
          placeholder="Ej: Encabezado institucional"
        />
      </div>

      {/* Editor HTML */}
      <div>
        <label style={labelStyle}>Código HTML</label>
        <textarea
          style={{
            ...inputStyle,
            fontFamily: "monospace",
            fontSize: 12,
            minHeight: 220,
            resize: "vertical",
            lineHeight: 1.5,
          }}
          value={html}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, html: e.target.value },
            })
          }
          placeholder="<h4>Título</h4><p>Contenido...</p>"
          spellCheck={false}
        />
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
          Soporta HTML completo con estilos inline.
        </p>
      </div>

      {/* Preview en tiempo real */}
      <div>
        <label style={labelStyle}>Vista previa</label>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "10px 14px",
            background: "#ffffff",
            minHeight: 40,
          }}
          dangerouslySetInnerHTML={{ __html: html || "<em style='color:#9ca3af'>Sin contenido</em>" }}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13,
  fontFamily: "inherit",
  color: "#111827",
  background: "#f8fafc",
  outline: "none",
  boxSizing: "border-box",
};