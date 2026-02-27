import type { WidgetRenderProps } from "../../../types/widget.types";

export default function SelectRender({ widget }: WidgetRenderProps) {
  const options = (widget.config.options as string[]) || [];

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <select
        required={widget.required}
        defaultValue=""
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
          color: "#111827",
          backgroundColor: "#fff",
        }}
      >
        <option value="" disabled>
          {(widget.config.placeholder as string) || "Selecciona una opción"}
        </option>
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
