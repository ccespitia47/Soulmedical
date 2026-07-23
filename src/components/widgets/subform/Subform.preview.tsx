import type { WidgetPreviewProps } from "../../../types/widget.types";
import type { SubformField } from "./subform.types";

export default function SubformPreview({ widget }: WidgetPreviewProps) {
  const fields = (widget.config.fields as SubformField[]) || [];
  const addLabel = (widget.config.addButtonLabel as string) || "Agregar";

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#111827" }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>

      {fields.length === 0 ? (
        <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 8, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
          Sin campos configurados — edita las propiedades
        </div>
      ) : (
        <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>
            Campos: {fields.map(f => f.label).join(", ")}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>0 entradas</div>
        </div>
      )}

      <button
        type="button"
        disabled
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", background: "#00c2a8", color: "#fff",
          border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
          cursor: "not-allowed", opacity: 0.7,
        }}
      >
        ＋ {addLabel}
      </button>
    </div>
  );
}