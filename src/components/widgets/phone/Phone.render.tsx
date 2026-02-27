import type { WidgetRenderProps } from "../../../types/widget.types";

export default function PhoneRender({ widget }: WidgetRenderProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = e.key;
    // Solo permitir dígitos
    if (!/^[0-9]$/.test(char)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    // Bloquear pegado si contiene caracteres no numéricos
    if (!/^\d+$/.test(pasted)) {
      e.preventDefault();
    }
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span
          style={{
            padding: "8px 10px",
            border: "1.5px solid #e2e8f0",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            fontSize: 13.5,
            backgroundColor: "#f1f5f9",
            color: "#111827",
            fontWeight: 500,
            lineHeight: "1.5",
          }}
        >
          {(widget.config.prefix as string) || "+57"}
        </span>
        <input
          type="tel"
          required={widget.required}
          placeholder={(widget.config.placeholder as string) || "300 123 4567"}
          maxLength={(widget.config.maxLength as number) || 10}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
