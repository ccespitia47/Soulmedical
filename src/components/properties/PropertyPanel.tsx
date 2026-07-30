import { useBuilderStore } from "../../store/useBuilderStore";
import { widgetRegistry } from "../widgets/registry";

export default function PropertyPanel({ onClose }: { onClose?: () => void }) {
  const { widgets, selectedWidgetId, updateWidget } = useBuilderStore();
  const widget = widgets.find((w) => w.id === selectedWidgetId);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 14px 10px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
            Propiedades
          </h2>
          {widget && (
            <span style={{ fontSize: 11, color: "#00c2a8", fontWeight: 500 }}>
              {widgetRegistry[widget.type]?.label}
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", width: 28, height: 28, borderRadius: 6 }}>
            ✕
          </button>
        )}
      </div>

      {/* Sin widget seleccionado */}
      {!widget && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center", color: "#9ca3af" }}>
          <span style={{ fontSize: 36, opacity: 0.4 }}>⚙️</span>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>
            Selecciona un campo para editar sus propiedades
          </p>
        </div>
      )}

      {/* Propiedades del widget seleccionado */}
      {widget && (
        <div style={{ flex: 1, padding: "16px 14px", overflowY: "auto" }}>
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
    </div>
  );
}