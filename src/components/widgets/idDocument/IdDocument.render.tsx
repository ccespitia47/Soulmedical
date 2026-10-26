import { useEffect, useMemo, useRef, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import {
  formatWithSeparator,
  ID_DOC_COUNTRIES,
  ID_DOC_COUNTRY_MAP,
  stripSeparator,
  type IdDocType,
} from "../../../lib/idDocuments";

const SELECT_STYLE: React.CSSProperties = {
  padding: "8px 10px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "#f8fafc",
  color: "#111827",
  outline: "none",
  cursor: "pointer",
};

export default function IdDocumentRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const enabledCountryCodes = useMemo(
    () => (cfg.countries as string[]) || ["CO"],
    [cfg.countries],
  );
  const defaultCountry = (cfg.defaultCountry as string) || enabledCountryCodes[0];
  const thousandsSeparator = (cfg.thousandsSeparator as "none" | "dot" | "comma") ||
    "none";

  const enabledCountries = useMemo(
    () =>
      ID_DOC_COUNTRIES.filter((c) => enabledCountryCodes.includes(c.code)),
    [enabledCountryCodes],
  );

  const [countryCode, setCountryCode] = useState<string>(
    enabledCountryCodes.includes(defaultCountry)
      ? defaultCountry
      : enabledCountryCodes[0],
  );

  const country = ID_DOC_COUNTRY_MAP[countryCode];
  const types = country?.types ?? [];

  const [typeCode, setTypeCode] = useState<string>(types[0]?.code ?? "");
  const currentType: IdDocType | undefined = types.find(
    (t) => t.code === typeCode,
  );

  // Al cambiar de país, saltar al primer tipo del nuevo país.
  useEffect(() => {
    if (!currentType && types.length > 0) {
      setTypeCode(types[0].code);
    }
  }, [countryCode, currentType, types]);

  const [rawValue, setRawValue] = useState<string>("");
  const numberInputRef = useRef<HTMLInputElement>(null);

  // Valor limpio (sin separadores cosméticos) — el que va a la BD.
  const cleanValue = useMemo(() => stripSeparator(rawValue), [rawValue]);

  // Validación bloqueante — usa setCustomValidity para que el submit del
  // form se detenga si el número no cumple el formato del tipo.
  useEffect(() => {
    const el = numberInputRef.current;
    if (!el || !currentType) return;
    if (!cleanValue) {
      el.setCustomValidity("");
      return;
    }
    const ok = currentType.validate(cleanValue);
    el.setCustomValidity(
      ok
        ? ""
        : `Formato inválido para ${currentType.name}${
            currentType.placeholder ? ` (${currentType.placeholder})` : ""
          }`,
    );
  }, [cleanValue, currentType]);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (currentType?.numericOnly) {
      // Reformateamos con separador cosmético para números.
      setRawValue(formatWithSeparator(val, thousandsSeparator));
    } else {
      // Alfanumérico: mantenemos tal cual, upperfy para consistencia.
      setRawValue(val);
    }
  };

  const showCountrySelector = enabledCountries.length > 1;

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#111827",
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>

      {/* 3 hidden inputs para BD: número (limpio), país, tipo. */}
      <input type="hidden" name={widget.id} value={cleanValue} />
      <input
        type="hidden"
        name={`${widget.id}__country`}
        value={countryCode}
      />
      <input
        type="hidden"
        name={`${widget.id}__type`}
        value={typeCode}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {showCountrySelector && (
          <select
            style={{ ...SELECT_STYLE, flex: "0 0 auto", minWidth: 120 }}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            aria-label="País"
          >
            {enabledCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        )}

        <select
          style={{ ...SELECT_STYLE, flex: "0 0 auto", minWidth: 140 }}
          value={typeCode}
          onChange={(e) => setTypeCode(e.target.value)}
          aria-label="Tipo de documento"
        >
          {types.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>

        <input
          ref={numberInputRef}
          type="text"
          inputMode={currentType?.numericOnly ? "numeric" : "text"}
          value={rawValue}
          placeholder={currentType?.placeholder ?? "Número"}
          onChange={handleNumberChange}
          required={widget.required}
          style={{
            flex: "1 1 200px",
            minWidth: 0,
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: 7,
            fontSize: 13.5,
            fontFamily: "inherit",
            background: "white",
            color: "#111827",
            outline: "none",
          }}
        />
      </div>

      {currentType?.placeholder && (
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "5px 0 0",
            lineHeight: 1.4,
          }}
        >
          Formato esperado: {currentType.placeholder}
        </p>
      )}
    </div>
  );
}
