import { useRef, useState } from "react";
import ExcelEmailUploader from "./ExcelEmailUploader";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  /** Muestra el botón para subir Excel (default true). */
  showExcelUploader?: boolean;
  /** Muestra mensaje de error si ninguno es válido (default true). */
  showValidationHint?: boolean;
  hasError?: boolean;
};

/**
 * Input tipo "chips" para múltiples emails. Se escribe email + Enter (o coma)
 * y aparece como una pill. La X quita una pill. Backspace en un input vacío
 * quita la última pill.
 *
 * Deduplica case-insensitive y valida formato básico antes de agregar.
 * Incluye botón para subir Excel con columna `email` que agrega todos los
 * emails del archivo (dedupe automático).
 *
 * Diferencia con RecipientsInput (email/config): este NO tiene dropdown de
 * grupos ni de usuarios registrados — es para emails puros (ej: tareas por
 * email a personas que no necesariamente están en el sistema).
 */
export default function ChipEmailInput({
  emails,
  onChange,
  placeholder = "Escribe un email y Enter…",
  showExcelUploader = true,
  showValidationHint = true,
  hasError = false,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setInvalidHint(`"${raw}" no es un email válido`);
      setTimeout(() => setInvalidHint(null), 3000);
      return;
    }
    if (emails.some((e) => e.toLowerCase() === email)) {
      setInvalidHint(`${email} ya está en la lista`);
      setTimeout(() => setInvalidHint(null), 3000);
      return;
    }
    onChange([...emails, email]);
    setInputValue("");
    inputRef.current?.focus();
  };

  const remove = (idx: number) => {
    onChange(emails.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      addEmail(inputValue.replace(/,$/, ""));
    }
    if (e.key === "Backspace" && inputValue === "" && emails.length > 0) {
      remove(emails.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Si el usuario pega múltiples emails separados por coma o salto de
    // línea, los agregamos todos a la vez.
    const pasted = e.clipboardData.getData("text");
    if (/[,\n\r;\s]/.test(pasted)) {
      e.preventDefault();
      const parts = pasted.split(/[,\n\r;\s]+/).filter(Boolean);
      for (const p of parts) addEmail(p);
    }
  };

  return (
    <div>
      <div
        className="relative flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-1.5"
        style={{
          borderColor: hasError ? "#fca5a5" : "#e2e8f0",
          background: hasError ? "#fef2f2" : "#fff",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, idx) => (
          <span
            key={`${email}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded-[20px] border-[1.5px] px-2 py-0.5 text-xs font-semibold"
            style={{ background: "#f3f4f6", borderColor: "#e2e8f0", color: "#374151" }}
          >
            <span className="text-[13px]">✉️</span>
            <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
              {email}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(idx);
              }}
              className="ml-0.5 cursor-pointer border-none bg-transparent p-0 text-[13px] leading-none text-gray-500 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="min-w-[180px] flex-1 border-none bg-transparent text-[13px] text-gray-900 outline-none"
        />
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
        {showValidationHint && (
          <span className="text-gray-400">
            Enter o coma para agregar · pegá varios separados por coma/espacio
          </span>
        )}
        {showExcelUploader && (
          <ExcelEmailUploader
            existingEmails={emails}
            onAdd={(added) => onChange([...emails, ...added])}
            compact
          />
        )}
        {invalidHint && <span className="text-red-600 font-semibold">{invalidHint}</span>}
      </div>
    </div>
  );
}
