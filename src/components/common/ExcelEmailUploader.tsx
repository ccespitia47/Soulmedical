import { useRef, useState } from "react";
import * as ExcelJS from "exceljs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  /** Lista actual de emails ya cargados — para deduplicar (case-insensitive). */
  existingEmails: string[];
  /** Callback con los emails NUEVOS (sin duplicados) que el usuario subió. */
  onAdd: (newEmails: string[]) => void;
  /** Texto del botón (opcional). Default "📄 Subir Excel". */
  label?: string;
  /** Estilo compacto para caber en toolbars pequeñas. */
  compact?: boolean;
};

/**
 * Botón para subir un Excel con una columna `email` y agregar todos los
 * emails a la lista destino. Deduplica case-insensitive contra
 * `existingEmails` y valida formato básico. Muestra un toast pequeño con
 * el resumen (N agregados, M duplicados, K inválidos).
 *
 * Detecta la columna "email" por header (búsqueda case-insensitive, acepta
 * "Email", "EMAIL", "correo", "email address", etc.). Si no encuentra
 * header claro, usa la primera columna.
 */
export default function ExcelEmailUploader({
  existingEmails,
  onAdd,
  label = "📄 Subir Excel",
  compact = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setFeedback(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("El Excel no tiene hojas");

      // Detectar columna con emails: busca header por keyword conocidas
      // (email / correo / mail). Si no hay header claro, usa la col 1.
      const emailColIdx = detectEmailColumn(ws);

      // Recolectar todos los valores no vacíos de esa columna, saltando
      // la primera fila si contenía el header. Los primeros 2 filas se
      // evalúan: si alguna parece email válido, se incluye — no forzamos.
      const raw: string[] = [];
      const rowCount = ws.actualRowCount;
      for (let r = 1; r <= rowCount; r++) {
        const cell = ws.getRow(r).getCell(emailColIdx);
        const val = cell.value;
        if (val == null) continue;
        // Cell.value puede ser string, number, {richText: [...]}, {formula, result}, etc.
        const s = typeof val === "string" ? val : typeof val === "number" ? String(val) : extractCellString(val);
        if (s) raw.push(s.trim());
      }

      // Normalizar, validar y deduplicar
      const existingSet = new Set(existingEmails.map((e) => e.trim().toLowerCase()));
      const newSet = new Set<string>();
      let duplicates = 0;
      let invalid = 0;
      for (const item of raw) {
        const email = item.toLowerCase();
        if (!EMAIL_RE.test(email)) {
          invalid += 1;
          continue;
        }
        if (existingSet.has(email) || newSet.has(email)) {
          duplicates += 1;
          continue;
        }
        newSet.add(email);
      }

      const added = Array.from(newSet);
      onAdd(added);
      const parts: string[] = [];
      parts.push(`${added.length} agregado${added.length === 1 ? "" : "s"}`);
      if (duplicates > 0) parts.push(`${duplicates} duplicado${duplicates === 1 ? "" : "s"}`);
      if (invalid > 0) parts.push(`${invalid} inválido${invalid === 1 ? "" : "s"}`);
      setFeedback({ kind: "ok", msg: parts.join(" · ") });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setFeedback({ kind: "err", msg: `No se pudo leer el Excel: ${detail}` });
    } finally {
      setBusy(false);
      // Reset input para permitir volver a subir el mismo archivo.
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const btnStyle = compact
    ? "cursor-pointer rounded-md border border-[#00c2a8]/30 bg-[#00c2a8]/5 px-2 py-1 text-[11px] font-semibold text-[#0891b2] hover:bg-[#00c2a8]/10 disabled:cursor-not-allowed disabled:opacity-50"
    : "cursor-pointer rounded-lg border border-[#00c2a8]/30 bg-[#00c2a8]/5 px-3 py-1.5 text-[12px] font-semibold text-[#0891b2] hover:bg-[#00c2a8]/10 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className={btnStyle}
        title="Subir un Excel con columna 'email' — agrega los emails a la lista actual"
      >
        {busy ? "⏳ Leyendo…" : label}
      </button>
      {feedback && (
        <span
          className={`ml-2 text-[11px] font-semibold ${
            feedback.kind === "ok" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {feedback.msg}
        </span>
      )}
    </>
  );
}

/**
 * Detecta cuál columna del worksheet tiene los emails. Prioridad:
 *   1. Header de la fila 1 que contenga "email" / "correo" / "mail"
 *   2. Cualquier valor de la fila 1 que YA parece un email (no había header)
 *   3. Fallback: columna 1
 */
function detectEmailColumn(ws: ExcelJS.Worksheet): number {
  const header = ws.getRow(1);
  const maxCol = ws.actualColumnCount || 1;
  const keywords = ["email", "correo", "mail", "e-mail"];
  for (let c = 1; c <= maxCol; c++) {
    const raw = header.getCell(c).value;
    const s = (typeof raw === "string" ? raw : extractCellString(raw))
      .trim()
      .toLowerCase();
    if (keywords.some((k) => s.includes(k))) return c;
  }
  // No hubo header — si la primera fila ya trae un email, tomamos esa col.
  for (let c = 1; c <= maxCol; c++) {
    const raw = header.getCell(c).value;
    const s = (typeof raw === "string" ? raw : extractCellString(raw)).trim();
    if (EMAIL_RE.test(s)) return c;
  }
  return 1;
}

/** Extrae texto plano de un cell.value que puede ser objeto (richText, formula, hyperlink). */
function extractCellString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyVal = val as any;
    if (anyVal.text) return String(anyVal.text);
    if (anyVal.result != null) return String(anyVal.result);
    if (Array.isArray(anyVal.richText)) {
      return anyVal.richText.map((r: { text?: string }) => r.text ?? "").join("");
    }
  }
  return "";
}
