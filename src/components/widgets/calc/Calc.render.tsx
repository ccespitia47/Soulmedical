import { useEffect, useMemo, useState } from "react";
import Icon from "../../common/Icon";
import type { WidgetRenderProps } from "../../../types/widget.types";

type CalcTerm = { type: "widget" | "fixed"; widgetId?: string; value?: number };

const CURRENCY_SYMBOLS: Record<string, string> = {
  COP: "$",
  USD: "US$",
  EUR: "€",
  MXN: "MX$",
};

const NA = "—";

/**
 * Aplica el operador. Todos usan `initialValue` como seed cuando el operador
 * es asociativo (sum, multiply). subtract/divide arrancan en initialValue si
 * está definido, de lo contrario en `values[0]`. Devuelve `null` si el
 * resultado es indefinido (división por cero, agregación de 0 elementos en
 * min/max).
 */
function calculate(
  operator: string,
  values: number[],
  initialValue: number,
  initialProvided: boolean,
): number | null {
  switch (operator) {
    case "sum":
      return values.reduce((a, b) => a + b, initialValue);
    case "subtract": {
      if (initialProvided) return values.reduce((a, b) => a - b, initialValue);
      if (values.length === 0) return 0;
      return values.slice(1).reduce((a, b) => a - b, values[0]);
    }
    case "multiply":
      return values.reduce(
        (a, b) => a * b,
        initialProvided ? initialValue : 1,
      );
    case "divide": {
      const seed = initialProvided ? initialValue : values[0];
      const rest = initialProvided ? values : values.slice(1);
      let result = seed ?? 0;
      for (const v of rest) {
        if (v === 0) return null;
        result /= v;
      }
      return result;
    }
    case "average":
      if (values.length === 0) return initialProvided ? initialValue : 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      if (values.length === 0) return null;
      return Math.min(...values);
    case "max":
      if (values.length === 0) return null;
      return Math.max(...values);
    case "count":
      return values.length;
    default:
      return 0;
  }
}

export default function CalcRender({
  widget,
  fieldValues,
  hiddenWidgetIds,
}: WidgetRenderProps) {
  const cfg = widget.config;
  const terms: CalcTerm[] = (cfg.terms as CalcTerm[]) || [];
  const operator = (cfg.operator as string) || "sum";
  const decimalPrecision = (cfg.decimalPrecision as number) ?? 2;
  const ignoreInvalid = (cfg.ignoreInvalid as boolean) ?? true;
  const ignoreHidden = (cfg.ignoreHidden as boolean) ?? false;
  const isPrice = (cfg.isPrice as boolean) ?? false;
  const currency = (cfg.currency as string) || "COP";

  const initialRaw = (cfg.initialValue as string) ?? "";
  const initialProvided = initialRaw.trim() !== "";
  const initialValue = initialProvided ? parseFloat(initialRaw) || 0 : 0;

  const [result, setResult] = useState<number | null>(
    initialProvided ? initialValue : null,
  );

  // Firma de los valores relevantes de fieldValues. Para widgets normales
  // es el valor directo; para campos de subform (ids compuestos `sub:field`)
  // el valor referenciado es el JSON del subform entero (`fieldValues[sub]`).
  const relevantSignature = useMemo(() => {
    const parts: string[] = [];
    for (const t of terms) {
      if (t.type !== "widget" || !t.widgetId) continue;
      const [refId] = t.widgetId.split(":", 1);
      parts.push(`${t.widgetId}=${fieldValues?.[refId] ?? ""}`);
    }
    return parts.join("|");
  }, [terms, fieldValues]);

  useEffect(() => {
    const values: number[] = [];

    for (const term of terms) {
      if (term.type === "fixed") {
        values.push(term.value ?? 0);
        continue;
      }
      if (term.type === "widget" && term.widgetId) {
        // Autoreferencia — nunca sumar el propio widget (evita loops).
        if (term.widgetId === widget.id) continue;

        // Campo de subform: id compuesto `subformWidgetId:fieldId`. Se
        // suma el campo en TODAS las filas del subform (semántica default,
        // intuitiva: el total del subform para ese campo). El resultado
        // participa como UN número más en el operador global del calc.
        if (term.widgetId.includes(":")) {
          const [subformId, fieldId] = term.widgetId.split(":", 2);
          if (!subformId || !fieldId) continue;
          if (ignoreHidden && hiddenWidgetIds?.has(subformId)) continue;
          const rawSub = fieldValues?.[subformId] ?? "";
          let entries: Record<string, unknown>[] = [];
          try {
            const parsed = rawSub ? JSON.parse(rawSub) : [];
            if (Array.isArray(parsed)) entries = parsed as Record<string, unknown>[];
          } catch {
            entries = [];
          }
          let sum = 0;
          for (const e of entries) {
            const v = parseFloat(String(e?.[fieldId] ?? ""));
            if (!Number.isNaN(v)) sum += v;
          }
          values.push(sum);
          continue;
        }

        if (ignoreHidden && hiddenWidgetIds?.has(term.widgetId)) continue;

        const raw = fieldValues?.[term.widgetId] ?? "";
        const num = parseFloat(raw);
        if (Number.isNaN(num)) {
          if (!ignoreInvalid) values.push(0);
          continue;
        }
        values.push(num);
      }
    }

    setResult(calculate(operator, values, initialValue, initialProvided));
    // relevantSignature captura los cambios de fieldValues sin re-ejecutar en
    // cada keystroke global; el resto son primitivas ya listadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    relevantSignature,
    operator,
    initialValue,
    initialProvided,
    ignoreInvalid,
    ignoreHidden,
    hiddenWidgetIds,
    widget.id,
    // terms es objeto: cambia con cada set() en props; ok que dispare.
    terms,
  ]);

  const formatted =
    result === null
      ? NA
      : isPrice
        ? `${CURRENCY_SYMBOLS[currency] ?? currency} ${result.toLocaleString(
            "es-CO",
            {
              minimumFractionDigits: decimalPrecision,
              maximumFractionDigits: decimalPrecision,
            },
          )}`
        : result.toFixed(decimalPrecision);

  const submitValue = result === null ? "" : String(result);

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

      {/* Hidden input para que el submit incluya el valor calculado. */}
      <input type="hidden" name={widget.id} value={submitValue} />

      <div
        style={{
          padding: "10px 14px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: isPrice ? 18 : 16,
            fontWeight: 700,
            color: isPrice ? "#0891b2" : "#111827",
            fontFamily: "monospace",
          }}
        >
          {formatted}
        </span>
        <Icon name="calc" size={16} />
      </div>

      {terms.length === 0 && (
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 4,
            margin: "4px 0 0",
          }}
        >
          Sin términos configurados.
        </p>
      )}
      {result === null && terms.length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            marginTop: 4,
            margin: "4px 0 0",
          }}
        >
          Sin valor todavía.
        </p>
      )}
    </div>
  );
}
