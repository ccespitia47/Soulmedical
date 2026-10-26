import { useEffect, useRef, useState } from "react";
import type { SubformEntry, SubformField } from "../subform.types";

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
    return (
      <h3 className="m-0 text-base font-bold text-slate-900">
        {field.label}
      </h3>
    );
  }

  if (field.type === "htmlblock") {
    return (
      <div
        className="prose prose-sm max-w-none text-[13.5px] text-slate-700"
        dangerouslySetInnerHTML={{ __html: field.htmlContent || field.placeholder || "" }}
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
    return (
      <img
        src={src}
        alt={field.label}
        className="max-h-[240px] rounded-md border border-slate-200 object-contain"
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
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`${INPUT_BASE} resize-y`}
      />
    );
  }

  // ── Select / Search (search sin fuente externa — opciones predefinidas, igual que select) ──
  if (field.type === "select" || field.type === "search") {
    return (
      <select
        name={field.id}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_BASE} cursor-pointer`}
      >
        <option value="">-- Selecciona --</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // ── Radio / Opción única ──
  if (field.type === "radio") {
    return (
      <div className="flex flex-col gap-1.5">
        {(field.options || []).map((opt) => (
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
    );
  }

  // ── Checkbox multi ──
  if (field.type === "checkbox") {
    let selected: string[] = [];
    try {
      selected = value ? JSON.parse(value) : [];
    } catch {
      selected = [];
    }
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((x) => x !== opt)
        : [...selected, opt];
      onChange(JSON.stringify(next));
    };
    return (
      <div className="flex flex-col gap-1.5">
        {(field.options || []).map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 text-[13px]">
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

  // ── Price (number con prefix visual) ──
  if (field.type === "price") {
    const prefix = field.pricePrefix || "$";
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
          {prefix}
        </span>
        <input
          type="number"
          name={field.id}
          required={field.required}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_BASE} pl-10`}
        />
      </div>
    );
  }

  // ── Signature (canvas base64) ──
  if (field.type === "signature") {
    return <SignaturePad value={value} onChange={onChange} name={field.id} />;
  }

  // ── Photo (file → base64) ──
  if (field.type === "photo") {
    return (
      <PhotoCapture value={value} onChange={onChange} name={field.id} />
    );
  }

  // ── File adjunto ──
  if (field.type === "file") {
    return (
      <FileAttach
        value={value}
        onChange={onChange}
        name={field.id}
        accept={field.accept}
      />
    );
  }

  // ── Barcode / Scanner cédula / Documento ID — input de texto; la cámara
  // es una mejora futura. Mantenemos semántica para la data. ──
  if (field.type === "barcode" || field.type === "idscanner" || field.type === "idDocument") {
    return (
      <input
        type="text"
        name={field.id}
        required={field.required}
        value={value}
        placeholder={field.placeholder || (field.type === "barcode" ? "Escanea o escribe código" : "Número de documento")}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_BASE}
      />
    );
  }

  // ── Calc (suma de campos number del mismo row) ──
  if (field.type === "calc") {
    const sum = computeCalc(field, entry, fields);
    const display = sum.toFixed(2);
    // Actualiza value hacia arriba para que quede en el entry serializado.
    if (value !== display) onChange(display);
    return (
      <div className="flex items-center justify-between rounded-md border-[1.5px] border-cyan-400 bg-cyan-50/50 px-3 py-2.5 font-mono text-[15px] font-bold text-cyan-700">
        <span>Σ</span>
        <span>{display}</span>
      </div>
    );
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

  // ── Quiz score (suma de puntos ganados en todos los quiz_question del row) ──
  if (field.type === "quiz_score") {
    const total = computeQuizScore(entry, fields);
    const display = String(total);
    if (value !== display) onChange(display);
    return (
      <div className="flex items-center justify-between rounded-md border-[1.5px] border-amber-400 bg-amber-50 px-3 py-2.5 font-mono text-[15px] font-bold text-amber-700">
        <span>🏆 Nota</span>
        <span>{display}</span>
      </div>
    );
  }

  // text / number / email / phone / date / time
  const typeMap: Record<string, string> = {
    text: "text",
    number: "number",
    email: "email",
    phone: "tel",
    date: "date",
    time: "time",
  };

  return (
    <input
      type={typeMap[field.type] || "text"}
      name={field.id}
      required={field.required}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_BASE}
    />
  );
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

// ─── SignaturePad: canvas básico con firma como base64 ───────────────────
function SignaturePad({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
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
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
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
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  const handle = (f: File | null) => {
    if (!f) return;
    setBusy(true);
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
        accept="image/*"
        capture="environment"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {busy && <div className="mt-1 text-xs text-slate-500">Cargando…</div>}
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
}: {
  value: string;
  onChange: (v: string) => void;
  name: string;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const handle = (f: File | null) => {
    if (!f) return;
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
      {value && !busy && (
        <div className="mt-1 text-xs text-emerald-700">✓ Archivo adjuntado {fileName && `(${fileName})`}</div>
      )}
    </div>
  );
}
