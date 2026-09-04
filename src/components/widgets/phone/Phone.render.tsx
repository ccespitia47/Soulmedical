import { useState, useRef, useEffect } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import { COUNTRIES, findCountry, type Country } from "../../../lib/countries";
import CountryPickerModal from "./CountryPickerModal";

export default function PhoneRender({ widget }: WidgetRenderProps) {
  const enableSelector = (widget.config.enableCountrySelector as boolean) || false;
  const defaultCode = (widget.config.defaultCountry as string) || "CO";
  const legacyPrefix = (widget.config.prefix as string) || "+57";
  const configuredPlaceholder = (widget.config.placeholder as string) || "";

  const [country, setCountry] = useState<Country>(() => findCountry(defaultCode));
  const [modalOpen, setModalOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [value, setValue] = useState(
    () => (widget.config.defaultValue as string) || "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Cuando cambia el país, re-validar el value actual contra el nuevo pattern.
  useEffect(() => {
    if (!enableSelector || !inputRef.current) return;
    validate(value, country);
  }, [country.code, enableSelector, value]);

  function validate(v: string, c: Country) {
    if (!inputRef.current) return;
    if (v === "" || c.pattern.test(v)) {
      inputRef.current.setCustomValidity("");
    } else {
      inputRef.current.setCustomValidity(
        `El número no corresponde a ${c.name}`,
      );
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/^\d+$/.test(pasted)) e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (enableSelector) validate(v, country);
  };

  const showError =
    enableSelector && touched && value !== "" && !country.pattern.test(value);

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {enableSelector ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={`Cambiar país (actual: ${country.name})`}
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
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 16 }}>{country.flag}</span>
            <span>{country.dialCode}</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>▾</span>
          </button>
        ) : (
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
            {legacyPrefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="tel"
          name={widget.id}
          required={widget.required}
          placeholder={configuredPlaceholder || (enableSelector ? country.placeholder : "300 123 4567")}
          maxLength={enableSelector ? country.maxLength : (widget.config.maxLength as number) || 10}
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: `1.5px solid ${showError ? "#ef4444" : "#e2e8f0"}`,
            borderRadius: "0 6px 6px 0",
            fontSize: 13.5,
            boxSizing: "border-box",
          }}
        />
      </div>
      {showError && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>
          El número no corresponde a {country.name}
        </p>
      )}
      {enableSelector && (
        <input type="hidden" name={`${widget.id}_country`} value={country.code} />
      )}
      {modalOpen && (
        <CountryPickerModal
          selectedCode={country.code}
          onSelect={(c) => {
            setCountry(c);
            setModalOpen(false);
            // Re-focus el input para que el usuario siga tipeando.
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
