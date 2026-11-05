import { useEffect, useRef, useState } from "react";
import type { SubformEntry, SubformField } from "../subform.types";
import { sanitizeHtml } from "../../../../utils/sanitize";
import {
  deleteSubmissionFile,
  uploadSubmissionFile,
} from "../../../../services/submissionUploads";
import { COUNTRIES } from "../../../../lib/countries";
import Icon from "../../../common/Icon";
import { searchGoogleSheets } from "../../search/sources/googleSheets";
import { searchExcelWeb } from "../../search/sources/excelWeb";
import type { SearchWidgetConfig } from "../../search/search.types";

const INPUT_BASE =
  "box-border w-full rounded-[7px] border-[1.5px] border-slate-200 bg-neutral-50 px-3 py-2.5 font-sans text-[13.5px] text-gray-900 outline-none focus:border-[#00c2a8]";

type FieldInputProps = {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
  /** Todas las entradas de la fila actual — necesario para widgets como
   *  calc o quiz_score que leen el valor de OTROS campos del mismo subform
   *  row. Opcional para no romper usos antiguos. */
  entry?: SubformEntry;
  fields?: SubformField[];
  /** Actualiza varios fields del row a la vez — lo usa `search` para
   *  rellenar otros fields desde el resultado seleccionado del modal. */
  onPatchEntry?: (patch: Record<string, string>) => void;
};

export default function FieldInput({
  field,
  value,
  onChange,
  entry,
  fields,
  onPatchEntry,
}: FieldInputProps) {
  // ── Decorativos (no envían valor pero el <input hidden> mantiene FormData feliz) ──
  if (field.type === "header") {
    const text = field.headerText || field.label;
    const size = field.headerSize || "medium";
    const sizeClass =
      size === "large"
        ? "text-xl font-bold"
        : size === "small"
          ? "text-sm font-semibold"
          : "text-base font-bold";
    const showDivider = field.showDivider ?? true;
    return (
      <div className={showDivider ? "border-b border-slate-200 pb-2" : ""}>
        <h3 className={`m-0 text-slate-900 ${sizeClass}`}>{text}</h3>
      </div>
    );
  }

  if (field.type === "htmlblock") {
    // Sanitizamos el HTML igual que el widget htmlblock del form principal
    // para evitar XSS si un admin malicioso mete <script>…</script> en el
    // htmlContent de un subformulario.
    const raw = field.htmlContent || field.placeholder || "";
    return (
      <div
        className="prose prose-sm max-w-none text-[13.5px] text-slate-700"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
      />
    );
  }

  if (field.type === "image") {
    const src = field.url || "";
    if (!src) {
      return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
          Sin URL de imagen configurada
        </div>
      );
    }
    const style: React.CSSProperties = {
      maxWidth: field.maxWidth ? `${field.maxWidth}px` : undefined,
      maxHeight: field.maxHeight ? `${field.maxHeight}px` : 240,
      cursor: field.clickable ? "zoom-in" : "default",
    };
    return (
      <img
        src={src}
        alt={field.label}
        className="rounded-md border border-slate-200 object-contain"
        style={style}
        onClick={() => {
          if (field.clickable) window.open(src, "_blank", "noopener");
        }}
      />
    );
  }

  if (field.type === "video") {
    return <VideoCapture field={field} value={value} onChange={onChange} />;
  }

  // ── Textarea ──
  if (field.type === "textarea") {
    return (
      <textarea
        name={field.id}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={field.rows ?? 3}
        className={`${INPUT_BASE} resize-y`}
      />
    );
  }

  // ── Text (con defaultValue, maxLength y filtros de teclado) ──
  if (field.type === "text") {
    return <TextInput field={field} value={value} onChange={onChange} />;
  }

  // ── Select ──
  if (field.type === "select") {
    return <SelectInput field={field} value={value} onChange={onChange} />;
  }

  // ── Search (externo: google_sheets / excel_web / sql) ──
  if (field.type === "search") {
    return (
      <SearchInput
        field={field}
        value={value}
        onChange={onChange}
        onPatchEntry={onPatchEntry}
      />
    );
  }

  // ── Radio ──
  if (field.type === "radio") {
    return <RadioInput field={field} value={value} onChange={onChange} />;
  }

  // ── Checkbox multi ──
  if (field.type === "checkbox") {
    return <CheckboxInput field={field} value={value} onChange={onChange} />;
  }

  // ── Price ──
  if (field.type === "price") {
    return <PriceInput field={field} value={value} onChange={onChange} />;
  }

  // ── Signature (canvas base64) ──
  if (field.type === "signature") {
    return (
      <SignaturePad
        value={value}
        onChange={onChange}
        name={field.id}
        penColor={field.penColor || "#000000"}
        penWidth={field.penWidth ?? 2}
      />
    );
  }

  // ── Photo (file → base64) ──
  if (field.type === "photo") {
    return (
      <PhotoCapture
        value={value}
        onChange={onChange}
        name={field.id}
        allowCamera={field.allowCamera ?? true}
        allowUpload={field.allowUpload ?? true}
        maxSizeMB={field.maxSizeMB}
      />
    );
  }

  // ── File adjunto ──
  if (field.type === "file") {
    return (
      <FileAttach
        value={value}
        onChange={onChange}
        name={field.id}
        accept={field.accept || fileTypeToAccept(field.fileType)}
        maxSizeMB={field.maxSizeMB}
      />
    );
  }

  // Nota: barcode / idscanner caen en el SimpleTextInput de abajo (texto
  // plano con defaultValue/maxLength). La cámara real es mejora futura.
  // idDocument tiene su propio IdDocumentInput con thousandsSeparator.

  // ── Calc ──
  if (field.type === "calc") {
    return <CalcInput field={field} value={value} onChange={onChange} entry={entry} fields={fields} />;
  }

  // ── Quiz question (radio con puntos) ──
  if (field.type === "quiz_question") {
    const correctIdx = field.correctOptionIndex ?? -1;
    const points = field.points ?? 1;
    const options = field.options || [];
    const earned = options[correctIdx] && value === options[correctIdx] ? points : 0;
    // Hidden auxiliar para que quiz_score pueda sumar: guardamos tanto el
    // valor legible como los puntos ganados (clave compuesta `${id}__points`).
    return (
      <>
        <div className="flex flex-col gap-1.5">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
        <input type="hidden" name={`${field.id}__points`} value={String(earned)} />
      </>
    );
  }

  // ── Quiz score ──
  if (field.type === "quiz_score") {
    return <QuizScoreInput field={field} value={value} onChange={onChange} entry={entry} fields={fields} />;
  }

  // ── Number ──
  if (field.type === "number") {
    return <NumberInput field={field} value={value} onChange={onChange} />;
  }

  // ── Date (defaultValue, minDate, maxDate) ──
  if (field.type === "date") {
    return <DateInput field={field} value={value} onChange={onChange} />;
  }

  // ── Time (nowByDefault + rememberInput) ──
  if (field.type === "time") {
    return <TimeInput field={field} value={value} onChange={onChange} />;
  }

  // ── Phone (prefijo visual + maxLength + defaultValue) ──
  if (field.type === "phone") {
    return <PhoneInput field={field} value={value} onChange={onChange} />;
  }

  // ── idDocument (thousandsSeparator opcional) ──
  if (field.type === "idDocument") {
    return <IdDocumentInput field={field} value={value} onChange={onChange} />;
  }

  // text / email / barcode / idscanner (textos planos con defaultValue)
  return <SimpleTextInput field={field} value={value} onChange={onChange} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Evalúa una fórmula simple del campo calc: suma los valores (como number)
 * de los ids referenciados dentro del `entry`. Formato soportado: ids
 * separados por `+`, con soporte opcional de `-`, `*`, `/`. Ej. "a+b", "a-b*2".
 * Si la fórmula está vacía, suma todos los campos number del row.
 */
function computeCalc(
  field: SubformField,
  entry?: SubformEntry,
  fields?: SubformField[],
): number {
  if (!entry || !fields) return 0;
  const expr = (field.formula || "").trim();

  if (!expr) {
    let sum = 0;
    for (const f of fields) {
      if (f.id === field.id) continue;
      if (!["number", "price"].includes(f.type)) continue;
      const n = parseFloat(entry[f.id] ?? "0");
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }

  // Reemplaza cada id en la expresión por su valor numérico del entry.
  let replaced = expr;
  for (const f of fields) {
    const n = parseFloat(entry[f.id] ?? "0");
    const num = Number.isFinite(n) ? n : 0;
    replaced = replaced.replace(new RegExp(`\\b${escapeRegex(f.id)}\\b`, "g"), String(num));
  }
  // Solo permitimos aritmética básica tras el reemplazo.
  if (!/^[\d+\-*/.()\s]*$/.test(replaced)) return 0;
  try {
    // Función Function restringida a la expresión ya saneada (sin acceso a scope).
    const r = Function(`"use strict"; return (${replaced || 0});`)();
    return typeof r === "number" && Number.isFinite(r) ? r : 0;
  } catch {
    return 0;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function computeQuizScore(entry?: SubformEntry, fields?: SubformField[]): number {
  if (!entry || !fields) return 0;
  let sum = 0;
  for (const f of fields) {
    if (f.type !== "quiz_question") continue;
    const correctIdx = f.correctOptionIndex ?? -1;
    const correctOpt = (f.options || [])[correctIdx];
    if (correctOpt && entry[f.id] === correctOpt) {
      sum += f.points ?? 1;
    }
  }
  return sum;
}

// ─── RadioInput: mismo look que el widget radio del form principal ──────
function RadioInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const vertical = field.verticalAlign ?? true;
  const remember = field.rememberInput ?? false;
  const storageKey = `soulforms_subform_radio_${field.id}`;
  const defaultValue = field.defaultValue || "";

  // Al montar: si no hay value, usar la última entrada recordada o el default.
  useEffect(() => {
    if (value) return;
    if (remember) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          onChange(stored);
          return;
        }
      } catch {
        /* storage bloqueado */
      }
    }
    if (defaultValue) onChange(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remember || !value) return;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* storage bloqueado */
    }
  }, [remember, value, storageKey]);

  // Modo rico (con imágenes por opción) usa radioOptions; si no, caemos a
  // options: string[] — así formularios viejos siguen renderizando igual.
  const useImageLabels = field.useImageLabels && (field.radioOptions?.length ?? 0) > 0;
  const options: Array<{ key: string; label: string; imageUrl?: string }> =
    useImageLabels
      ? (field.radioOptions || []).map((o) => ({
          key: o.label, // value canónico sigue siendo el label, para compat con datos ya guardados
          label: o.label,
          imageUrl: o.imageUrl,
        }))
      : (field.options || []).map((o) => ({ key: o, label: o }));

  return (
    <div
      style={{
        display: vertical ? "flex" : "grid",
        flexDirection: vertical ? "column" : undefined,
        gridTemplateColumns: vertical
          ? undefined
          : useImageLabels
            ? "repeat(auto-fit, minmax(120px, 1fr))"
            : "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
      }}
    >
      {options.map((opt, index) => {
        const isSelected = value === opt.key;
        return (
          <label
            key={opt.key}
            style={{
              display: "flex",
              flexDirection: useImageLabels ? "column" : "row",
              alignItems: useImageLabels ? "center" : "center",
              gap: useImageLabels ? 6 : 10,
              padding: useImageLabels ? "10px 8px" : "8px 12px",
              border: isSelected
                ? "1.5px solid #0891b2"
                : "1.5px solid #e2e8f0",
              borderRadius: 8,
              background: isSelected ? "#ecfeff" : "#f8fafc",
              cursor: "pointer",
              fontSize: 13.5,
              color: "#111827",
              transition: "all 0.15s ease-out",
              textAlign: useImageLabels ? "center" : "left",
            }}
          >
            {useImageLabels && opt.imageUrl && (
              <img
                src={opt.imageUrl}
                alt={opt.label}
                style={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 6,
                  background: "#fff",
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: useImageLabels ? 6 : 10,
              }}
            >
              <input
                type="radio"
                name={field.id}
                value={opt.key}
                required={field.required && index === 0}
                checked={isSelected}
                onChange={() => onChange(opt.key)}
                style={{ accentColor: "#0891b2", flexShrink: 0 }}
              />
              <span
                style={{
                  whiteSpace: vertical || useImageLabels ? "normal" : "nowrap",
                }}
              >
                {opt.label}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ─── TextInput: filtros de teclado + maxLength + defaultValue ───────────
function TextInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const allowNumbers = field.allowNumbers ?? true;
  const allowSpecialChars = field.allowSpecialChars ?? true;
  const allowLineBreaks = field.allowLineBreaks ?? false;

  // Si viene vacío al montar, aplicar defaultValue.
  useEffect(() => {
    if (!value && field.defaultValue) onChange(field.defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (allowNumbers && allowSpecialChars) return;
    const char = e.key;
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

  if (allowLineBreaks) {
    return (
      <textarea
        name={field.id}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        rows={field.rows ?? 3}
        className={`${INPUT_BASE} resize-y`}
      />
    );
  }
  return (
    <input
      type="text"
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={handleKeyPress}
      className={INPUT_BASE}
    />
  );
}

// ─── SelectInput: multiple, expand, sortAlphabetically, defaultValue, remember
function SelectInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const multiple = field.multiple ?? false;
  const expand = field.expand ?? false;
  const sortAlphabetically = field.sortAlphabetically ?? false;
  const remember = field.rememberInput ?? false;
  const storageKey = `soulforms_subform_select_${field.id}`;

  const raw = field.options || [];
  const options = sortAlphabetically
    ? [...raw].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      )
    : raw;

  // Init: defaultValue o localStorage.
  useEffect(() => {
    if (value) return;
    if (remember) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          onChange(stored);
          return;
        }
      } catch {
        /* storage bloqueado */
      }
    }
    if (field.defaultValue) onChange(field.defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remember || !value) return;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* storage bloqueado */
    }
  }, [remember, value, storageKey]);

  // Multi (comma-separated igual que el main / checkbox del subform).
  const parseMulti = (raw: string): string[] => {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const arr = JSON.parse(t);
        return Array.isArray(arr) ? arr.map(String) : [];
      } catch {
        /* fallthrough */
      }
    }
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  };

  if (expand) {
    const selected = multiple ? parseMulti(value) : [value];
    const toggle = (opt: string) => {
      if (multiple) {
        const next = selected.includes(opt)
          ? selected.filter((x) => x !== opt)
          : [...selected, opt];
        onChange(next.join(","));
      } else {
        onChange(opt);
      }
    };
    return (
      <div className="flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-[13px]"
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={field.id}
              value={opt}
              required={field.required && !multiple && i === 0}
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (multiple) {
    const selected = parseMulti(value);
    return (
      <select
        name={field.id}
        required={field.required}
        multiple
        value={selected}
        onChange={(e) => {
          const picked = Array.from(e.target.selectedOptions).map(
            (o) => o.value,
          );
          onChange(picked.join(","));
        }}
        className={`${INPUT_BASE} min-h-[80px] cursor-pointer`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      name={field.id}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT_BASE} cursor-pointer`}
    >
      <option value="">
        {field.placeholder || "-- Selecciona --"}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// ─── PriceInput: currency + decimalMark + precision + min/max + remember ─
function PriceInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const currency = field.currency || "COP";
  const decimalMark = field.decimalMark || "comma";
  const decimalPrecision = field.decimalPrecision ?? 2;
  const minAmount = field.minAmount;
  const maxAmount = field.maxAmount;
  const remember = field.rememberInput ?? false;
  const prefix = field.pricePrefix || "$";
  const storageKey = `soulforms_subform_price_${field.id}`;

  const [raw, setRaw] = useState(value);
  const [error, setError] = useState("");

  useEffect(() => {
    if (raw) return;
    if (remember) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setRaw(stored);
          onChange(stored.replace(",", "."));
          return;
        }
      } catch {
        /* storage bloqueado */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value;
    if (decimalMark === "comma") next = next.replace(/[^0-9,]/g, "");
    else next = next.replace(/[^0-9.]/g, "");
    setRaw(next);
    setError("");
    const num = parseFloat(next.replace(",", "."));
    if (!Number.isNaN(num)) {
      if (minAmount !== undefined && num < minAmount) {
        setError(`Mínimo: ${prefix} ${minAmount}`);
      } else if (maxAmount !== undefined && num > maxAmount) {
        setError(`Máximo: ${prefix} ${maxAmount}`);
      }
    }
    const normalized = next.replace(",", ".");
    onChange(normalized);
    if (remember) {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* storage */
      }
    }
  };

  const placeholder =
    decimalMark === "comma"
      ? `0,${"0".repeat(decimalPrecision)}`
      : `0.${"0".repeat(decimalPrecision)}`;

  return (
    <div>
      <input type="hidden" name={field.id} value={raw.replace(",", ".")} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1.5px solid ${error ? "#ef4444" : "#e2e8f0"}`,
          borderRadius: 7,
          overflow: "hidden",
          background: "white",
        }}
      >
        <span
          style={{
            padding: "8px 10px",
            background: "#f1f5f9",
            borderRight: "1px solid #e2e8f0",
            fontSize: 14,
            fontWeight: 700,
            color: "#0891b2",
            flexShrink: 0,
            fontFamily: "monospace",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {prefix}
        </span>
        <input
          type="text"
          inputMode="decimal"
          placeholder={field.placeholder || placeholder}
          value={raw}
          onChange={handleChange}
          required={field.required}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            fontSize: 13.5,
            fontFamily: "inherit",
            outline: "none",
            background: "white",
            color: "#111827",
            minWidth: 0,
          }}
        />
        <span
          style={{
            padding: "8px 10px",
            fontSize: 11,
            color: "#94a3b8",
            flexShrink: 0,
            fontFamily: "monospace",
          }}
        >
          {currency}
        </span>
      </div>
      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", margin: "5px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── CalcInput: operator + initialValue + precision + formula fallback ──
function CalcInput({
  field,
  value,
  onChange,
  entry,
  fields,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
  entry?: SubformEntry;
  fields?: SubformField[];
}) {
  const precision = field.decimalPrecision ?? 2;
  const isPrice = field.isPrice ?? false;
  const prefix = field.pricePrefix || "$";

  const result = useMemoLike(() => {
    // Si hay fórmula, usar evaluador existente (compat con lo que ya guardaron).
    if ((field.formula || "").trim()) return computeCalc(field, entry, fields);
    // Si no, aplicar calcOperator sobre todos los campos number del row.
    return applyOperator(field, entry, fields);
  }, [field, entry, fields]);

  const display =
    result === null ? NA_RESULT : result.toFixed(precision);

  useEffect(() => {
    if (value !== display) onChange(display);
  }, [display, value, onChange]);

  return (
    <div className="flex items-center justify-between rounded-md border-[1.5px] border-cyan-400 bg-cyan-50/50 px-3 py-2.5 font-mono text-[15px] font-bold text-cyan-700">
      <span>{isPrice ? prefix : "Σ"}</span>
      <span>{display}</span>
    </div>
  );
}

// ─── QuizScoreInput: visibility, showMax, precision, includedIds ────────
function QuizScoreInput({
  field,
  value,
  onChange,
  entry,
  fields,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
  entry?: SubformEntry;
  fields?: SubformField[];
}) {
  const visibility = field.visibility || "visible";
  const showMax = field.showMax ?? true;
  const precision = field.decimalPrecision ?? 1;
  const includeQuestions = field.includeQuestions || "all";
  const includedIds = field.includedIds || [];

  const { total, max } = useMemoLike(() => {
    if (!entry || !fields) return { total: 0, max: 0 };
    let total = 0;
    let max = 0;
    for (const f of fields) {
      if (f.type !== "quiz_question") continue;
      if (includeQuestions === "select" && !includedIds.includes(f.id)) continue;
      const correctIdx = f.correctOptionIndex ?? -1;
      const correctOpt = (f.options || [])[correctIdx];
      const points = f.points ?? 1;
      max += points;
      if (correctOpt && entry[f.id] === correctOpt) total += points;
    }
    return { total, max };
  }, [entry, fields, includeQuestions, includedIds]);

  const totalStr = total.toFixed(precision);
  const display = showMax ? `${totalStr} / ${max.toFixed(precision)}` : totalStr;

  useEffect(() => {
    if (value !== totalStr) onChange(totalStr);
  }, [totalStr, value, onChange]);

  if (visibility === "hidden") {
    return <input type="hidden" name={field.id} value={totalStr} />;
  }
  if (visibility === "after_submit") {
    // Dentro del subform no sabemos si ya hubo submit; marcamos como pendiente.
    return (
      <>
        <input type="hidden" name={field.id} value={totalStr} />
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
          La nota se mostrará después del envío
        </div>
      </>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border-[1.5px] border-amber-400 bg-amber-50 px-3 py-2.5 font-mono text-[15px] font-bold text-amber-700">
      <span>🏆 Nota</span>
      <span>{display}</span>
      <input type="hidden" name={field.id} value={totalStr} />
    </div>
  );
}

const NA_RESULT = "—";

/** React.useMemo shim local — evita import extra arriba del archivo.
 * (Igual podríamos usar useMemo directo, pero ya tenemos useEffect/useState;
 *  dejamos un wrapper por claridad.) */
function useMemoLike<T>(fn: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; val: T } | null>(null);
  const same =
    ref.current &&
    ref.current.deps.length === deps.length &&
    ref.current.deps.every((d, i) => d === deps[i]);
  if (!same) ref.current = { deps, val: fn() };
  return ref.current!.val;
}

/** Aplica calcOperator a todos los campos numéricos del row. */
function applyOperator(
  field: SubformField,
  entry?: SubformEntry,
  fields?: SubformField[],
): number | null {
  if (!entry || !fields) return 0;
  const op = field.calcOperator || "sum";
  const ignoreInvalid = field.ignoreInvalid ?? true;
  const initial = field.initialValue;
  const initialProvided = typeof initial === "number";

  const values: number[] = [];
  for (const f of fields) {
    if (f.id === field.id) continue;
    if (!["number", "price", "calc"].includes(f.type)) continue;
    const raw = entry[f.id];
    if (raw === undefined || raw === "") {
      if (!ignoreInvalid) values.push(0);
      continue;
    }
    const n = parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n)) values.push(n);
    else if (!ignoreInvalid) values.push(0);
  }

  switch (op) {
    case "sum":
      return values.reduce((a, b) => a + b, initial ?? 0);
    case "subtract": {
      if (initialProvided) return values.reduce((a, b) => a - b, initial);
      if (values.length === 0) return 0;
      return values.slice(1).reduce((a, b) => a - b, values[0]);
    }
    case "multiply":
      return values.reduce((a, b) => a * b, initialProvided ? initial : 1);
    case "divide": {
      const seed = initialProvided ? initial : values[0];
      const rest = initialProvided ? values : values.slice(1);
      let r = seed ?? 0;
      for (const v of rest) {
        if (v === 0) return null;
        r /= v;
      }
      return r;
    }
    case "average":
      if (values.length === 0) return initialProvided ? initial : 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return values.length === 0 ? null : Math.min(...values);
    case "max":
      return values.length === 0 ? null : Math.max(...values);
    case "count":
      return values.length;
    default:
      return 0;
  }
}

// ─── CheckboxInput: comma-separated + seed con defaultValue ────────────
function CheckboxInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  const parseValue = (raw: string): string[] => {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const arr = JSON.parse(t);
        return Array.isArray(arr) ? arr.map(String) : [];
      } catch {
        /* fallthrough */
      }
    }
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  };
  const selected = parseValue(value);
  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((x) => x !== opt)
      : [...selected, opt];
    onChange(next.join(","));
  };
  return (
    <div className="flex flex-col gap-1.5">
      {(field.options || []).map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-2 text-[13px]"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

// Mapa de categoría de archivo → `accept` del <input type="file">.
function fileTypeToAccept(t: SubformField["fileType"]): string | undefined {
  switch (t) {
    case "documents":
      return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "images":
      return "image/*";
    case "audio":
      return "audio/*";
    case "video":
      return "video/*";
    default:
      return undefined;
  }
}

// ─── Subcomponentes con `useEffect` para defaultValue inicial ────────────

function useDefaultSeed(
  value: string,
  defaultValue: string | undefined,
  onChange: (v: string) => void,
) {
  useEffect(() => {
    if (!value && defaultValue) onChange(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function NumberInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  const allowDecimals = field.allowDecimals ?? true;
  const step = field.step ?? (allowDecimals ? undefined : 1);
  return (
    <input
      type="number"
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      min={field.min}
      max={field.max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value;
        if (!allowDecimals && /[.,]/.test(raw)) return;
        onChange(raw);
      }}
      className={INPUT_BASE}
    />
  );
}

function DateInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  return (
    <input
      type="date"
      name={field.id}
      required={field.required}
      value={value}
      min={field.minDate}
      max={field.maxDate}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_BASE}
    />
  );
}

function TimeInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const remember = field.rememberInput ?? false;
  const storageKey = `soulforms_subform_time_${field.id}`;

  useEffect(() => {
    if (value) return;
    if (remember) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          onChange(stored);
          return;
        }
      } catch {
        /* storage */
      }
    }
    if (field.nowByDefault) {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      onChange(`${hh}:${mm}`);
    } else if (field.defaultValue) {
      onChange(field.defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remember || !value) return;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* storage */
    }
  }, [remember, value, storageKey]);

  return (
    <input
      type="time"
      name={field.id}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_BASE}
    />
  );
}

function PhoneInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  // Si el country selector está activo, el dialCode del defaultCountry gana
  // sobre el prefix custom. Buscamos el país; si no está (código raro), caemos
  // al prefix o a nada. Alineado con el main widget Phone.
  let prefix = field.prefix || "";
  if (field.enableCountrySelector) {
    const code = field.defaultCountry || "CO";
    const country = COUNTRIES.find((c) => c.code === code);
    if (country) prefix = country.dialCode;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: "1.5px solid #e2e8f0",
        borderRadius: 7,
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      {prefix && (
        <span
          style={{
            padding: "8px 10px",
            background: "#f1f5f9",
            borderRight: "1px solid #e2e8f0",
            fontSize: 13.5,
            color: "#475569",
            fontFamily: "monospace",
            flexShrink: 0,
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type="tel"
        name={field.id}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: "8px 12px",
          border: "none",
          fontSize: 13.5,
          fontFamily: "inherit",
          outline: "none",
          background: "transparent",
          color: "#111827",
          minWidth: 0,
        }}
      />
    </div>
  );
}

function IdDocumentInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  // Soporta tri-estado ("none" | "dot" | "comma") + boolean legacy
  // (true=dot, false=none) para configs guardadas antes del cambio.
  const raw = field.thousandsSeparator;
  const mode: "none" | "dot" | "comma" =
    typeof raw === "string"
      ? raw
      : raw === true
        ? "dot"
        : "none";
  const sep = mode === "dot" ? "." : mode === "comma" ? "," : "";
  const digits = value.replace(/\D/g, "");
  const formatted = sep
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
    : value;
  return (
    <input
      type="text"
      name={field.id}
      required={field.required}
      value={formatted}
      placeholder={field.placeholder || "Número de documento"}
      onChange={(e) => {
        // Sea cual sea el separador elegido, al valor canónico siempre lo
        // dejamos sin separador — así la DB queda limpia.
        const next = sep
          ? e.target.value.split(sep).join("")
          : e.target.value;
        onChange(next);
      }}
      className={INPUT_BASE}
    />
  );
}

function SimpleTextInput({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  useDefaultSeed(value, field.defaultValue, onChange);
  const typeMap: Record<string, string> = {
    text: "text",
    email: "email",
    barcode: "text",
    idscanner: "text",
  };
  return (
    <input
      type={typeMap[field.type] || "text"}
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_BASE}
    />
  );
}

// ─── SignaturePad: canvas básico con firma como base64 ───────────────────
function SignaturePad({
  value,
  onChange,
  name,
  penColor = "#000000",
  penWidth = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
  penColor?: string;
  penWidth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);

  const point = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current!;
    onChange(c.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    onChange("");
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-md border-[1.5px] border-slate-300 bg-white"
        style={{ height: 160 }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1 cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
      >
        Limpiar firma
      </button>
    </div>
  );
}

// ─── PhotoCapture: input file con preview, guarda base64 ─────────────────
function PhotoCapture({
  value,
  onChange,
  name,
  allowCamera = true,
  allowUpload = true,
  maxSizeMB,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
  allowCamera?: boolean;
  allowUpload?: boolean;
  maxSizeMB?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handle = (f: File | null) => {
    if (!f) return;
    setError("");
    if (maxSizeMB && f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`);
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(typeof reader.result === "string" ? reader.result : "");
      setBusy(false);
    };
    reader.onerror = () => setBusy(false);
    reader.readAsDataURL(f);
  };
  // Si solo se permite cámara → `capture`. Si solo disco → sin capture.
  // Si ambos → sin capture (el user elige al tocar el input).
  const captureAttr = allowCamera && !allowUpload ? "environment" : undefined;
  if (!allowCamera && !allowUpload) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
        Este campo no tiene fuentes de captura habilitadas.
      </div>
    );
  }
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <input
        type="file"
        accept="image/*"
        capture={captureAttr}
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {busy && <div className="mt-1 text-xs text-slate-500">Cargando…</div>}
      {error && <div className="mt-1 text-xs text-red-600">⚠️ {error}</div>}
      {value && (
        <img
          src={value}
          alt="Preview"
          className="mt-2 max-h-[200px] rounded border border-slate-200 object-contain"
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-1 cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
        >
          Quitar foto
        </button>
      )}
    </div>
  );
}

// ─── FileAttach: archivo genérico → base64 (data URL) ─────────────────────
function FileAttach({
  value,
  onChange,
  name,
  accept,
  maxSizeMB,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
  accept?: string;
  maxSizeMB?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState("");
  const handle = (f: File | null) => {
    if (!f) return;
    setError("");
    if (maxSizeMB && f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`);
      return;
    }
    setBusy(true);
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(typeof reader.result === "string" ? reader.result : "");
      setBusy(false);
    };
    reader.onerror = () => setBusy(false);
    reader.readAsDataURL(f);
  };
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <input
        type="file"
        accept={accept}
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {busy && <div className="mt-1 text-xs text-slate-500">Cargando…</div>}
      {error && <div className="mt-1 text-xs text-red-600">⚠️ {error}</div>}
      {value && !busy && !error && (
        <div className="mt-1 text-xs text-emerald-700">✓ Archivo adjuntado {fileName && `(${fileName})`}</div>
      )}
    </div>
  );
}

function formatVideoSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatVideoDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")} min` : `${s}s`;
}

function VideoCapture({
  field,
  value,
  onChange,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
}) {
  const maxDurationSecs = field.maxDurationSecs ?? 60;
  const maxSizeMB = field.maxSizeMB ?? 100;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [size, setSize] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // El fileId "canónico" se persiste en el value del subform entry como
  // `gridfs:<id>` — mismo contrato que el main widget Video. El estado
  // local (name/size/preview) es solo UX visual mientras la row esté
  // abierta; al remontar, el value basta para reconstruir que hay algo.
  const hasUploaded = value.startsWith("gridfs:");
  const currentFileId = hasUploaded ? value.slice("gridfs:".length) : "";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearLocalState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setName("");
    setSize(0);
    setDuration(0);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El video excede el tamaño máximo de ${maxSizeMB} MB`);
      e.target.value = "";
      return;
    }

    const url = URL.createObjectURL(f);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onloadedmetadata = async () => {
      if (vid.duration > maxDurationSecs) {
        setError(
          `El video excede la duración máxima de ${formatVideoDuration(maxDurationSecs)}`,
        );
        URL.revokeObjectURL(url);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setName(f.name);
      setSize(f.size);
      setDuration(vid.duration);
      setBusy(true);

      const previous = currentFileId;
      const res = await uploadSubmissionFile(f);
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (res.error) {
        setError(res.error);
        clearLocalState();
        return;
      }
      onChange(`gridfs:${res.fileId}`);
      if (previous && previous !== res.fileId) {
        void deleteSubmissionFile(previous);
      }
    };
    vid.onerror = () => {
      setError("No se pudo leer el video seleccionado");
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = "";
    };
  };

  const handleRemove = () => {
    if (currentFileId) void deleteSubmissionFile(currentFileId);
    onChange("");
    setError("");
    clearLocalState();
  };

  const showPreview = !!name || hasUploaded;

  return (
    <div>
      <input type="hidden" name={field.id} value={value} />
      {!showPreview ? (
        <div
          onClick={() => !busy && fileRef.current?.click()}
          className={`flex cursor-${busy ? "wait" : "pointer"} flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-slate-50 px-3 py-6 transition-colors hover:border-cyan-600 hover:bg-cyan-50`}
        >
          <span className="text-cyan-700">
            <Icon name="video" size={28} />
          </span>
          <span className="text-[13px] font-semibold text-slate-600">
            Añadir video
          </span>
          <span className="text-[11px] text-slate-400">
            Máx. {formatVideoDuration(maxDurationSecs)} · {maxSizeMB} MB
          </span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50">
          {previewUrl && (
            <video
              src={previewUrl}
              controls
              className="block max-h-[220px] w-full bg-black"
            />
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-900">
                {name || "Video adjuntado"}
              </div>
              <div className="text-[11px] text-slate-500">
                {size > 0 && `${formatVideoSize(size)}`}
                {duration > 0 && ` · ${formatVideoDuration(duration)}`}
                {busy
                  ? " · subiendo…"
                  : hasUploaded
                    ? " · subido"
                    : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="cursor-pointer rounded border-none bg-red-100 px-2.5 py-1 text-[12px] font-semibold text-red-600 disabled:cursor-not-allowed"
            >
              Borrar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-[12px] text-red-600">{error}</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

/**
 * Widget `search` del subform — mismo flujo que el main: input + botón que
 * abre un modal con resultados consultados en vivo de la fuente externa.
 *
 * Al seleccionar un row, guarda el value (de la columna de búsqueda o la
 * primera displayColumn) y, si hay searchMappings, rellena los otros
 * fields del mismo subform-row vía onPatchEntry. Esto es lo que hace útil
 * tener el widget: una sola búsqueda llena múltiples campos (ej. buscar
 * paciente → traer nombre, cédula, teléfono).
 *
 * Las funciones de fetch se reusan del main widget (googleSheets.ts,
 * excelWeb.ts). SQL por ahora cae a un fetch inline simple — si crece lo
 * extraemos a un source propio.
 */
type SearchRow = Record<string, unknown>;

function SearchInput({
  field,
  value,
  onChange,
  onPatchEntry,
}: {
  field: SubformField;
  value: string;
  onChange: (v: string) => void;
  onPatchEntry?: (patch: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const minChars = field.searchMinChars ?? 2;

  // Determina si la fuente está "lista" — hay URL/endpoint según el tipo.
  // Un search sin configuración completa no abre el modal; mostramos un
  // estado explícito en lugar de un select vacío que confundía al usuario.
  const source = field.searchSource;
  const configured =
    (source === "google_sheets" && !!field.sheetsUrl) ||
    (source === "excel_web" && !!field.excelUrl) ||
    (source === "sql" && !!field.sqlEndpoint);

  if (!configured) {
    return (
      <div className="rounded-[7px] border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-500">
        <Icon name="search" size={13} /> Este campo de búsqueda aún no tiene
        una fuente de datos configurada. Pídele al admin del formulario que
        complete la URL de Google Sheets / Excel o el endpoint SQL.
      </div>
    );
  }

  // Construye el SearchWidgetConfig que esperan searchGoogleSheets /
  // searchExcelWeb — es la forma más pragmática de reusar su lógica sin
  // duplicar el parseo de URLs, CSV, etc.
  const toMainConfig = (): SearchWidgetConfig => ({
    sourceType:
      field.searchSource === "excel_web"
        ? "excel_web"
        : field.searchSource === "sql"
          ? "sql"
          : "google_sheets",
    sheetsUrl: field.sheetsUrl,
    sheetsGid: field.sheetsGid,
    sheetsSearchCol: field.sheetsSearchCol,
    sheetColumns: field.sheetColumns,
    excelUrl: field.excelUrl,
    excelSearchCol: field.excelSearchCol,
    sqlEndpoint: field.sqlEndpoint,
    displayColumns: field.displayColumns,
    minChars,
  });

  const runSearch = async (query: string) => {
    setError("");
    setLoading(true);
    const cfg = toMainConfig();
    try {
      let result: SearchRow[] = [];
      if (field.searchSource === "google_sheets") {
        result = await searchGoogleSheets(cfg, query);
      } else if (field.searchSource === "excel_web") {
        result = await searchExcelWeb(cfg, query);
      } else if (field.searchSource === "sql" && field.sqlEndpoint) {
        const base =
          field.sqlEndpoint.startsWith("/") || field.sqlEndpoint.startsWith("http")
            ? field.sqlEndpoint
            : `/api/${field.sqlEndpoint}`;
        const token = localStorage.getItem("token") ?? "";
        const res = await fetch(base, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ q: query }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          result = Array.isArray(data?.rows) ? data.rows : [];
        } else {
          setError(`Backend respondió ${res.status}`);
        }
      }
      setRows(result);
    } catch (e) {
      setError((e as Error).message || "Error al consultar la fuente");
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    // Preview inicial al abrir: una búsqueda vacía — Sheets devuelve 50
    // primeras filas, Excel devuelve 0 (su backend no soporta preview).
    void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (q.length < minChars) {
      // Vuelve al preview inicial cuando el usuario borra.
      if (q.length === 0) void runSearch("");
      return;
    }
    const t = window.setTimeout(() => void runSearch(q), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  const pickRow = (row: SearchRow) => {
    // El value primario es la columna de búsqueda — si no existe, la
    // primera displayColumn — si no, el primer campo del row.
    const searchCol =
      field.searchSource === "excel_web"
        ? field.excelSearchCol
        : field.sheetsSearchCol;
    const firstDisplay = field.displayColumns?.[0]?.key;
    const primaryKey =
      (searchCol && row[searchCol] != null && searchCol) ||
      (firstDisplay && row[firstDisplay] != null && firstDisplay) ||
      Object.keys(row)[0];
    const primaryVal = primaryKey ? String(row[primaryKey] ?? "") : "";
    onChange(primaryVal);

    // Aplica mappings: columna fuente → field del subform.
    if (onPatchEntry && field.searchMappings?.length) {
      const patch: Record<string, string> = {};
      for (const m of field.searchMappings) {
        if (!m.sourceField || !m.targetFieldId) continue;
        const v = row[m.sourceField];
        if (v != null) patch[m.targetFieldId] = String(v);
      }
      if (Object.keys(patch).length > 0) onPatchEntry(patch);
    }

    setOpen(false);
  };

  const displayCols =
    field.displayColumns && field.displayColumns.length > 0
      ? field.displayColumns
      : (field.sheetColumns || []).map((k) => ({ key: k, label: k }));

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          name={field.id}
          required={field.required}
          value={value}
          placeholder={field.placeholder || "Haz clic en Buscar…"}
          readOnly
          onClick={() => setOpen(true)}
          className={`${INPUT_BASE} cursor-pointer`}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-cyan-700 hover:border-cyan-600"
        >
          <Icon name="search" size={14} /> Buscar
        </button>
        {value && (
          <button
            type="button"
            title="Limpiar"
            onClick={() => onChange("")}
            className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-slate-200 bg-white text-[14px] text-slate-400 hover:text-red-500"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon name="search" size={16} /> Buscar
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded border-none bg-transparent text-slate-500 hover:text-slate-800"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="border-b border-slate-200 px-5 py-3">
              <input
                autoFocus
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  minChars > 0
                    ? `Escribe al menos ${minChars} caracteres…`
                    : "Escribe para buscar…"
                }
                className={INPUT_BASE}
              />
              {error && (
                <p className="mt-1.5 text-[12px] text-red-600">{error}</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <p className="px-3 py-6 text-center text-[13px] text-slate-500">
                  Buscando…
                </p>
              ) : rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-slate-400">
                  Sin resultados
                </p>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {displayCols.map((c) => (
                        <th
                          key={c.key}
                          className="border-b border-slate-200 px-2 py-1.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="cursor-pointer border-b border-slate-100 hover:bg-cyan-50"
                        onClick={() => pickRow(row)}
                      >
                        {displayCols.map((c) => (
                          <td
                            key={c.key}
                            className="px-2 py-1.5 text-slate-700"
                          >
                            {String(row[c.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
