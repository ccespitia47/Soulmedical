import type { WidgetRenderProps } from "../../../types/widget.types";

export default function EmailRender({ widget }: WidgetRenderProps) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="email"
        required={widget.required}
        placeholder={(widget.config.placeholder as string) || "correo@ejemplo.com"}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
        }}
      />
      <span style={{
        display: "block",
        fontSize: 11.5,
        color: "#9ca3af",
        marginTop: 4,
      }}>
        Formato: ejemplo@dominio.com
      </span>
    </div>
  );
}
