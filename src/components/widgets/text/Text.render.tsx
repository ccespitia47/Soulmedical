import type { WidgetRenderProps } from "../../../types/widget.types";

export default function TextRender({ widget }: WidgetRenderProps) {
  const allowNumbers = (widget.config.allowNumbers as boolean) || false;
  const allowSpecialChars = (widget.config.allowSpecialChars as boolean) || false;
  const allowLineBreaks = (widget.config.allowLineBreaks as boolean) || false;

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Si se permiten ambos, no filtrar nada (Enter no es un "char" en input,
    // pero en textarea sí — y no debe bloquearse porque genera salto de línea).
    if (allowNumbers && allowSpecialChars) return;

    const char = e.key;

    // Enter en textarea siempre pasa (permite el salto de línea nativo).
    if (allowLineBreaks && char === "Enter") return;

    const isLetter = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]$/.test(char);
    const isNumber = /^[0-9]$/.test(char);
    const isSpace = char === " ";
    const specialChars = "@#$%&*()_+=-{}[];':\"\\|,.<>/?!¡¿";
    const isSpecialChar = specialChars.includes(char);

    let allowed = isLetter || isSpace;
    if (allowNumbers) allowed = allowed || isNumber;
    if (allowSpecialChars) allowed = allowed || isSpecialChar;

    if (!allowed) e.preventDefault();
  };

  const commonStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 13.5,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {allowLineBreaks ? (
        <textarea
          name={widget.id}
          required={widget.required}
          placeholder={(widget.config.placeholder as string) || ""}
          defaultValue={(widget.config.defaultValue as string) || ""}
          maxLength={(widget.config.maxLength as number) || undefined}
          rows={3}
          onKeyPress={handleKeyPress}
          style={{ ...commonStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          name={widget.id}
          required={widget.required}
          placeholder={(widget.config.placeholder as string) || ""}
          defaultValue={(widget.config.defaultValue as string) || ""}
          maxLength={(widget.config.maxLength as number) || undefined}
          onKeyPress={handleKeyPress}
          style={commonStyle}
        />
      )}
    </div>
  );
}
