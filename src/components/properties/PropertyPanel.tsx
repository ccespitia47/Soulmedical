import { useBuilderStore } from "../../store/useBuilderStore";
import { widgetRegistry } from "../widgets/registry";
import Icon from "../common/Icon";

export default function PropertyPanel({ onClose }: { onClose?: () => void }) {
  const { widgets, selectedWidgetId, updateWidget } = useBuilderStore();
  const widget = widgets.find((w) => w.id === selectedWidgetId);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "16px 14px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32, width: 32, borderRadius: 10, background: "linear-gradient(135deg,#00c2a8 0%,#0891b2 100%)", color: "#fff", boxShadow: "0 6px 16px -6px rgba(0,194,168,0.6)" }}>
            <Icon name="settings" size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: "#0f172a", margin: 0 }}>
              Propiedades
            </h2>
            {widget && (
              <span style={{ fontSize: 11, color: "#0891b2", fontWeight: 600 }}>
                {widgetRegistry[widget.type]?.label}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", width: 30, height: 30, borderRadius: 8 }}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Sin widget seleccionado */}
      {!widget && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32, textAlign: "center", color: "#94a3b8" }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, width: 56, borderRadius: 18, background: "#f1f5f9", color: "#94a3b8" }}>
            <Icon name="settings" size={26} />
          </span>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Selecciona un campo para editar sus propiedades
          </p>
        </div>
      )}

      {/* Nombre interno para plantillas PDF/Email. Si el admin lo deja
          vacío, el placeholder se calcula a partir del label con
          desambiguación automática por sufijo (ej. `cargo`, `cargo1`) —
          lo que puede dar strings larguísimos cuando el label es un
          párrafo entero (texto de autorización, declaraciones legales).
          Al llenarlo, se usa esa clave tal cual: `${declaracion}` en vez
          de `${autorizoaastellasfarmacolombias...}`. */}
      {widget && (() => {
        const labelLength = (widget.label ?? "").length;
        const autoKey = (widget.label || "campo")
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9]/gi, "");
        const autoKeyTooLong = autoKey.length > 30;
        const needsCustom = autoKeyTooLong && !widget.placeholder?.trim();
        return (
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #e2e8f0",
              background: needsCustom ? "#fef3c7" : "#f8fafc",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#64748b",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Nombre para plantilla PDF / Email{" "}
              <span style={{ fontWeight: 500, textTransform: "none", color: "#94a3b8" }}>
                (opcional, aparece como ${"{nombre}"})
              </span>
            </label>
            <input
              type="text"
              value={widget.placeholder ?? ""}
              onChange={(e) => updateWidget(widget.id, { placeholder: e.target.value })}
              placeholder={autoKeyTooLong ? "Dale un nombre corto (ej: declaracion)" : `Auto: ${autoKey}`}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "7px 10px",
                borderRadius: 8,
                border: `1.5px solid ${needsCustom ? "#f59e0b" : "#e2e8f0"}`,
                background: "#ffffff",
                fontSize: 13,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: "#0f172a",
                outline: "none",
              }}
            />
            {needsCustom && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: "#78350f",
                }}
              >
                ⚠️ Tu etiqueta tiene {labelLength} caracteres — el placeholder
                auto-generado sale como <code>${"{"}{autoKey.slice(0, 20)}…{"}"}</code>.
                Definí un nombre corto acá para que la plantilla quede legible.
              </p>
            )}
          </div>
        );
      })()}

      {/* Propiedades del widget seleccionado */}
      {widget && (
        <div className="sf-prop-panel" style={{ flex: 1, padding: "16px 14px", overflowY: "auto" }}>
          {(() => {
            const PropertiesComp = widgetRegistry[widget.type]?.properties;
            return PropertiesComp ? (
              <PropertiesComp widget={widget} updateWidget={updateWidget} allWidgets={widgets} />
            ) : (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin propiedades configurables</p>
            );
          })()}
        </div>
      )}

      {/*
        Restyle uniforme de TODOS los formularios de propiedades de widgets.
        Cada widget define sus estilos inline (16+ archivos), así que usamos
        !important para ganarle al inline sin tocar cada archivo: inputs con
        bordes redondeados, fondo blanco, foco con anillo teal, hover, y
        checkboxes/radios en teal.
      */}
      <style>{`
        .sf-prop-panel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]),
        .sf-prop-panel textarea,
        .sf-prop-panel select {
          border: 1.5px solid #e2e8f0 !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          transition: border-color .15s ease, box-shadow .15s ease !important;
        }
        .sf-prop-panel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):hover,
        .sf-prop-panel textarea:hover,
        .sf-prop-panel select:hover {
          border-color: #cbd5e1 !important;
        }
        .sf-prop-panel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):focus,
        .sf-prop-panel textarea:focus,
        .sf-prop-panel select:focus {
          border-color: #00c2a8 !important;
          box-shadow: 0 0 0 3px rgba(0,194,168,0.15) !important;
          outline: none !important;
        }
        .sf-prop-panel input[type="checkbox"],
        .sf-prop-panel input[type="radio"] {
          accent-color: #00c2a8;
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        .sf-prop-panel input[type="range"] { accent-color: #00c2a8; }
      `}</style>
    </div>
  );
}