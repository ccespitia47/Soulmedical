import Icon from "../../common/Icon";
import type { WidgetPropertiesProps } from "../../../types/widget.types";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#f8fafc",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};
const TERM_ROW: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const OPERATORS = [
  { value: "sum", label: "Suma (+)" },
  { value: "subtract", label: "Resta (−)" },
  { value: "multiply", label: "Multiplicar (×)" },
  { value: "divide", label: "Dividir (÷)" },
  { value: "average", label: "Promedio" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
  { value: "count", label: "Contar" },
];

const CURRENCIES = [
  { value: "COP", label: "Peso colombiano (COP)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "MXN", label: "Peso mexicano (MXN)" },
];

type CalcTerm = { type: "widget" | "fixed"; widgetId?: string; value?: number };

export default function CalcProperties({
  widget,
  updateWidget,
  allWidgets,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const terms: CalcTerm[] = (cfg.terms as CalcTerm[]) || [];

  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  // Widgets numéricos disponibles (excluye este mismo widget para evitar
  // autoreferencia). `rating` no existe en el registry actual.
  const numericTypes = ["number", "calc"];
  const availableWidgets = (allWidgets ?? []).filter(
    (w) => w.id !== widget.id && numericTypes.includes(w.type),
  );

  // Campos numéricos DENTRO de subformularios. Cada entry representa un
  // sub-campo tipo "number" (o similar) de un widget `subform`. El id del
  // término usa la convención compuesta `${subformWidgetId}:${fieldId}` —
  // el render detecta el `:` y suma los valores del field en todas las
  // filas (entries) del subform. Sumar es el default más natural para el
  // widget de cálculo; el operador global del Calc sigue aplicando sobre
  // esa suma + los otros términos.
  type SubformFieldLite = { id: string; type: string; label?: string };
  const subformFieldOptions: {
    id: string;
    label: string;
    subformLabel: string;
    fieldLabel: string;
  }[] = [];
  for (const w of allWidgets ?? []) {
    if (w.type !== "subform") continue;
    const fields = ((w.config?.fields as SubformFieldLite[] | undefined) ?? []).filter(
      (f) => ["number", "price", "calc"].includes(f.type),
    );
    for (const f of fields) {
      subformFieldOptions.push({
        id: `${w.id}:${f.id}`,
        label: `${w.label || "Subformulario"} → ${f.label || "(sin etiqueta)"}`,
        subformLabel: w.label || "Subformulario",
        fieldLabel: f.label || "(sin etiqueta)",
      });
    }
  }

  const addTerm = (type: "widget" | "fixed") => {
    const newTerm: CalcTerm =
      type === "widget"
        ? { type: "widget", widgetId: "" }
        : { type: "fixed", value: 0 };
    set({ terms: [...terms, newTerm] });
  };

  const updateTerm = (i: number, changes: Partial<CalcTerm>) =>
    set({
      terms: terms.map((t, idx) => (idx === i ? { ...t, ...changes } : t)),
    });

  const removeTerm = (i: number) =>
    set({ terms: terms.filter((_, idx) => idx !== i) });

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Operador */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Operador</label>
        <select
          style={INPUT}
          value={(cfg.operator as string) || "sum"}
          onChange={(e) => set({ operator: e.target.value })}
        >
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Términos */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <label style={{ ...LABEL, marginBottom: 0 }}>
            Términos del cálculo
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => addTerm("widget")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1.5px solid #0891b2",
                background: "white",
                color: "#0891b2",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="plus" size={12} /> Campo
            </button>
            <button
              type="button"
              onClick={() => addTerm("fixed")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1.5px solid #cbd5e1",
                background: "white",
                color: "#475569",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="plus" size={12} /> Fijo
            </button>
          </div>
        </div>

        {terms.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              textAlign: "center",
              padding: "10px 0",
              margin: 0,
            }}
          >
            Agrega campos numéricos o valores fijos para calcular.
          </p>
        )}

        {terms.map((term, i) => (
          <div key={i} style={TERM_ROW}>
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                minWidth: 18,
                fontWeight: 600,
              }}
            >
              {i + 1}.
            </span>
            {term.type === "widget" ? (
              <select
                style={{ ...INPUT, flex: 1, padding: "6px 10px" }}
                value={term.widgetId ?? ""}
                onChange={(e) => updateTerm(i, { widgetId: e.target.value })}
              >
                <option value="">— Selecciona campo —</option>
                {availableWidgets.length > 0 && (
                  <optgroup label="Campos del formulario">
                    {availableWidgets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label || `(sin etiqueta) — ${w.id}`}
                      </option>
                    ))}
                  </optgroup>
                )}
                {subformFieldOptions.length > 0 && (
                  <optgroup label="Campos de subformularios (suma de todas las filas)">
                    {subformFieldOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <input
                type="number"
                style={{ ...INPUT, flex: 1, padding: "6px 10px" }}
                value={term.value ?? 0}
                onChange={(e) =>
                  updateTerm(i, { value: parseFloat(e.target.value) || 0 })
                }
              />
            )}
            <span
              style={{
                fontSize: 10.5,
                color: "#94a3b8",
                minWidth: 32,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {term.type === "widget" ? "campo" : "fijo"}
            </span>
            <button
              type="button"
              onClick={() => removeTerm(i)}
              aria-label="Quitar término"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "none",
                background: "#fee2e2",
                color: "#ef4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Valor inicial */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Valor inicial</label>
        <input
          type="number"
          style={INPUT}
          placeholder="0"
          value={(cfg.initialValue as string) || ""}
          onChange={(e) => set({ initialValue: e.target.value })}
        />
      </div>

      {/* Precisión decimal */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Precisión decimal</label>
        <input
          type="number"
          style={INPUT}
          min={0}
          max={10}
          value={(cfg.decimalPrecision as number) ?? 2}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            set({ decimalPrecision: Number.isFinite(n) ? n : 0 });
          }}
        />
      </div>

      {/* Checkboxes */}
      {[
        { key: "ignoreInvalid", label: "Ignorar términos con valor no numérico" },
        { key: "ignoreHidden", label: "Ignorar campos ocultos por reglas" },
        { key: "isPrice", label: "El valor calculado es un precio" },
      ].map(({ key, label }) => (
        <label
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "#111827",
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={(cfg[key] as boolean) ?? false}
            onChange={(e) => set({ [key]: e.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}

      {/* Moneda (solo si isPrice) */}
      {(cfg.isPrice as boolean) && (
        <div style={{ marginTop: 6, marginBottom: 14 }}>
          <label style={LABEL}>Moneda</label>
          <select
            style={INPUT}
            value={(cfg.currency as string) || "COP"}
            onChange={(e) => set({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
