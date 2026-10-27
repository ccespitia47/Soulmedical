import { useEffect, useState } from "react";
import type {
  RuleCondition,
  RuleOperator,
  WidgetInstance,
} from "../../../types/widget.types";
import { fetchSheetsHeaders } from "../../widgets/search/sources/googleSheets";

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "es igual a",
  not_equals: "no es igual a",
  contains: "contiene",
  starts_with: "empieza con",
  ends_with: "termina con",
  not_empty: "no está vacío",
  is_empty: "está vacío",
  has_value: "tiene valor",
};

// Operadores que requieren un input de "value". `has_value` también lo pide,
// pero con un select Si/No en vez de texto/opciones — se maneja aparte abajo.
const OPERATORS_WITH_VALUE: RuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "has_value",
];

const HAS_VALUE_OPTIONS: { value: string; label: string }[] = [
  { value: "si", label: "Si" },
  { value: "no", label: "No" },
];

const SELECT_CLASS =
  "cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-gray-900 outline-none";
const INPUT_CLASS =
  "rounded-[7px] border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 font-sans text-xs text-gray-900 outline-none";

type RuleConditionRowProps = {
  condition: RuleCondition;
  /** El widget resuelto (ya buscado por widgetId). Se usa para saber
   *  si es `search` y, en ese caso, qué fuente tiene — así decidimos
   *  si cargamos columnas desde un Sheet o mostramos input manual. */
  triggerWidget?: WidgetInstance;
  triggerWidgets: WidgetInstance[];
  getOptions: (widgetId: string) => string[];
  onUpdate: (changes: Partial<RuleCondition>) => void;
  onRemove: () => void;
};

/** Cache compartida de headers por URL del Sheet. Evita re-fetchear la
 *  misma URL cada vez que el admin ajusta otra condición en el panel. */
const SHEET_HEADERS_CACHE = new Map<string, string[]>();

export default function RuleConditionRow({
  condition,
  triggerWidget,
  triggerWidgets,
  getOptions,
  onUpdate,
  onRemove,
}: RuleConditionRowProps) {
  const options = getOptions(condition.widgetId);
  const needsValue = OPERATORS_WITH_VALUE.includes(condition.operator);

  const isSearch = triggerWidget?.type === "search";
  const sheetsUrl =
    (triggerWidget?.config as { sheetsUrl?: string } | undefined)?.sheetsUrl?.trim() ??
    "";

  const [columns, setColumns] = useState<string[]>(() =>
    sheetsUrl ? SHEET_HEADERS_CACHE.get(sheetsUrl) ?? [] : [],
  );
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Carga las columnas (headers) del Sheet asociado al widget search cuando
  // cambia la URL. Si el search tiene otra fuente (apiUrl, excelWeb, sql,
  // formSubmissions, group), no sabemos los headers sin ejecutar la query,
  // así que caemos a un input de texto manual más abajo.
  useEffect(() => {
    if (!isSearch || !sheetsUrl) {
      setColumns([]);
      return;
    }
    const cached = SHEET_HEADERS_CACHE.get(sheetsUrl);
    if (cached) {
      setColumns(cached);
      return;
    }
    let cancelled = false;
    setLoadingColumns(true);
    fetchSheetsHeaders(sheetsUrl)
      .then((headers) => {
        if (cancelled) return;
        SHEET_HEADERS_CACHE.set(sheetsUrl, headers);
        setColumns(headers);
      })
      .catch(() => {
        if (!cancelled) setColumns([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingColumns(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSearch, sheetsUrl]);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <select
        value={condition.widgetId}
        onChange={(e) =>
          onUpdate({ widgetId: e.target.value, value: "", column: undefined })
        }
        className={SELECT_CLASS}
        style={{ flex: "0 0 180px", minWidth: 140 }}
      >
        {triggerWidgets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>

      {/* Dropdown de columna: solo para widgets `search`. Si el Sheet carga
          headers → <select>; si la fuente es otra (apiUrl, SQL, etc.) o aún
          no cargó → input de texto para que el admin tipee el nombre. */}
      {isSearch && (columns.length > 0 ? (
        <select
          value={condition.column ?? ""}
          onChange={(e) => onUpdate({ column: e.target.value || undefined })}
          className={SELECT_CLASS}
          style={{ flex: "0 0 150px", minWidth: 120 }}
          disabled={loadingColumns}
        >
          <option value="">Elegir un campo</option>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={condition.column ?? ""}
          onChange={(e) => onUpdate({ column: e.target.value || undefined })}
          placeholder={loadingColumns ? "Cargando campos…" : "Columna…"}
          className={INPUT_CLASS}
          style={{ flex: "0 0 150px", minWidth: 120 }}
        />
      ))}

      <select
        value={condition.operator}
        onChange={(e) =>
          onUpdate({ operator: e.target.value as RuleOperator, value: "" })
        }
        className={SELECT_CLASS}
        style={{ flex: "0 0 150px", minWidth: 120 }}
      >
        {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
          <option key={op} value={op}>
            {label}
          </option>
        ))}
      </select>

      {needsValue &&
        (condition.operator === "has_value" ? (
          <select
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={SELECT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
          >
            <option value="">-- Selecciona --</option>
            {HAS_VALUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : // Para search con columna elegida NO queremos el dropdown de
        // opciones del widget (eso aplica a select/radio); ahí es input libre
        // porque la columna del Sheet puede tener cualquier valor arbitrario.
        options.length > 0 && !(isSearch && condition.column) ? (
          <select
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className={SELECT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
          >
            <option value="">-- Selecciona --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Valor..."
            className={INPUT_CLASS}
            style={{ flex: "0 0 150px", minWidth: 120 }}
          />
        ))}

      <button
        onClick={onRemove}
        className="cursor-pointer border-none bg-transparent p-1 text-base text-gray-400"
      >
        ✕
      </button>
    </div>
  );
}
