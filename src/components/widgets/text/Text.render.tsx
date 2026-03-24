import type { WidgetRenderProps } from "../../../types/widget.types";

export default function TextRender({ widget }: WidgetRenderProps) {
  const allowNumbers = (widget.config.allowNumbers as boolean) || false;
  const allowSpecialChars = (widget.config.allowSpecialChars as boolean) || false;

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Si se permiten ambos, permitir todo
    if (allowNumbers && allowSpecialChars) {
      return;
    }

    const char = e.key;
    
    // Letras (incluyendo acentos y ñ)
    const isLetter = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]$/.test(char);
    
    // Números
    const isNumber = /^[0-9]$/.test(char);
    
    // Espacio
    const isSpace = char === " ";
    
    // Caracteres especiales comunes
    const specialChars = "@#$%&*()_+=-{}[];':\"\\|,.<>/?!¡¿";
    const isSpecialChar = specialChars.includes(char);

    // Determinar si el carácter está permitido
    let allowed = isLetter || isSpace;

    if (allowNumbers) {
      allowed = allowed || isNumber;
    }

    if (allowSpecialChars) {
      allowed = allowed || isSpecialChar;
    }

    if (!allowed) {
      e.preventDefault();
    }
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="text"
        name={widget.id}
        required={widget.required}
        placeholder={(widget.config.placeholder as string) || ""}
        defaultValue={(widget.config.defaultValue as string) || ""}
        maxLength={(widget.config.maxLength as number) || undefined}
        onKeyPress={handleKeyPress}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}