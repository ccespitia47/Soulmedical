import { useEffect, useRef, useState } from "react";
import type { SubformEntry, SubformField } from "../subform.types";
import { sanitizeHtml } from "../../../../utils/sanitize";

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
};

export default function FieldInput({ field, value, onChange, entry, fields }: FieldInputProps) {
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
    return (
      <div className={field.showDivider ? "border-b border-slate-200 pb-2" : ""}>
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
    const src = field.url || "";
    if (!src) {
      return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
          Sin URL de video configurada
        </div>
      );
    }
    // Si es YouTube/Vimeo detectamos y usamos iframe; sino <video>.
    const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/i.test(src);
    return isEmbed ? (
      <iframe
        src={src}
        className="aspect-video w-full rounded-md border border-slate-200"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    ) : (
      <video src={src} controls className="w-full rounded-md border border-slate-200" />
    );
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

  // ── Select / Search ──
  if (field.type === "select" || field.type === "search") {
    return <SelectInput field={field} value={value} onChange={onChange} />;
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

  const options = field.options || [];

  return (
    <div
      style={{
        display: vertical ? "flex" : "grid",
        flexDirection: vertical ? "column" : undefined,
        gridTemplateColumns: vertical
          ? undefined
          : "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
      }}
    >
      {options.map((opt, index) => {
        const isSelected = value === opt;
        return (
          <label
            key={opt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              border: isSelected
                ? "1.5px solid #0891b2"
                : "1.5px solid #e2e8f0",
              borderRadius: 8,
              background: isSelected ? "#ecfeff" : "#f8fafc",
              cursor: "pointer",
              fontSize: 13.5,
              color: "#111827",
              transition: "all 0.15s ease-out",
            }}
          >
            <input
              type="radio"
              name={field.id}
              value={opt}
              required={field.required && index === 0}
              checked={isSelected}
              onChange={() => onChange(opt)}
              style={{ accentColor: "#0891b2", flexShrink: 0 }}
            />
            <span style={{ whiteSpace: vertical ? "normal" : "nowrap" }}>
              {opt}
            </span>
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
  return (
    <input
      type="number"
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(e) => onChange(e.target.value)}
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
  const prefix = field.prefix || "";
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
  const useSep = field.thousandsSeparator ?? false;
  const formatted = useSep
    ? value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : value;
  return (
    <input
      type="text"
      name={field.id}
      required={field.required}
      value={formatted}
      placeholder={field.placeholder || "Número de documento"}
      onChange={(e) => {
        const next = useSep
          ? e.target.value.replace(/\./g, "")
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
