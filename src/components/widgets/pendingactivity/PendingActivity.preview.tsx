import type { WidgetPreviewProps } from "../../../types/widget.types";

/**
 * Vista del widget en el canvas del builder. Como no hay data real en
 * design time, mostramos dos ejemplos muted con checkbox deshabilitado
 * para que el admin se haga una idea de cómo va a verse en runtime.
 * Estilo inline-styles para match el resto de los widgets del palette.
 */
export default function PendingActivityPreview({ widget }: WidgetPreviewProps) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>
      <div
        style={{
          border: "1.5px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          overflow: "hidden",
        }}
      >
        {["Actividad planeada 1", "Actividad planeada 2"].map((t, i, arr) => (
          <div
            key={t}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "9px 12px",
              borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none",
              fontSize: 13,
              color: "#9ca3af",
            }}
          >
            <input type="checkbox" disabled /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}
