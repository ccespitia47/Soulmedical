import type { WidgetInstance } from "../types/widget.types";
import type { SubformField } from "../components/widgets/subform/subform.types";

export type AppPlaceholder = {
  placeholder: string;
  description: string;
  widgetType: string;
};

/**
 * Misma normalización que se usaba inline en EmailConfigPanel/FormPage/TaskPage.
 * Importante: si cambia, hay que cambiar TODOS los puntos donde se construyen
 * placeholders y donde se reemplazan — por eso vive aquí, en un solo sitio.
 */
export function normalizeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/gi, "");
}

/**
 * Genera la lista de placeholders ${campo} disponibles a partir de los widgets
 * del formulario. Para subformularios (que contienen múltiples campos cada uno
 * con múltiples entradas) genera placeholders compuestos:
 *
 *   ${miSubform:tabla}        → tabla HTML con todas las entradas
 *   ${miSubform.campoX}       → valores del campoX en todas las entradas
 *                                (separados por <br>)
 *   ${miSubform.count}        → número de entradas
 */
export function buildPlaceholders(
  widgets: Pick<WidgetInstance, "type" | "label" | "config">[],
): AppPlaceholder[] {
  const list: AppPlaceholder[] = [];
  for (const w of widgets) {
    const base = normalizeKey(w.label);
    if (!base) continue;

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      list.push({
        placeholder: `\${${base}:tabla}`,
        description: `${w.label} (tabla con todas las entradas)`,
        widgetType: w.type,
      });
      for (const f of fields) {
        const fk = normalizeKey(f.label);
        if (!fk) continue;
        list.push({
          placeholder: `\${${base}.${fk}}`,
          description: `${w.label} → ${f.label}`,
          widgetType: w.type,
        });
      }
      list.push({
        placeholder: `\${${base}.count}`,
        description: `${w.label} (número de entradas)`,
        widgetType: w.type,
      });
      continue;
    }

    list.push({
      placeholder: `\${${base}}`,
      description: w.label,
      widgetType: w.type,
    });
  }
  return list;
}

/**
 * Toma la data cruda del formulario (donde subform.value es un JSON string
 * serializado de las entries) y la "expande" a un diccionario plano con
 * keys que coinciden con los placeholders generados por buildPlaceholders.
 *
 * Para widgets normales: data[id] → out[normalizedLabel] = String(valor).
 * Para subformularios añade además:
 *   - out["nombre:tabla"]    = HTML <table>...</table>
 *   - out["nombre.campoX"]   = "v1<br>v2<br>v3"
 *   - out["nombre.count"]    = "N"
 *   - out["nombre"]          = JSON crudo (compat con uso previo)
 */
export function expandFormData(
  widgets: Pick<WidgetInstance, "id" | "type" | "label" | "config">[],
  data: Record<string, unknown>,
  hiddenIds?: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of widgets) {
    if (hiddenIds?.has(w.id)) continue;
    const base = normalizeKey(w.label);
    if (!base) continue;
    const raw = data[w.id];

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      const entries = parseSubformEntries(raw);
      out[base] = typeof raw === "string" ? raw : JSON.stringify(entries);
      out[`${base}:tabla`] = renderSubformTable(fields, entries);
      out[`${base}.count`] = String(entries.length);
      for (const f of fields) {
        const fk = normalizeKey(f.label);
        if (!fk) continue;
        out[`${base}.${fk}`] = entries
          .map((e) => escapeHtml(String(e[f.id] ?? "")))
          .filter(Boolean)
          .join("<br>");
      }
      continue;
    }

    if (raw == null) {
      out[base] = "";
    } else if (typeof raw === "string") {
      out[base] = raw;
    } else {
      out[base] = JSON.stringify(raw);
    }
  }
  return out;
}

// ── Helpers internos ───────────────────────────────────────────────────────

function parseSubformEntries(raw: unknown): Record<string, string>[] {
  if (Array.isArray(raw)) return raw as Record<string, string>[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Record<string, string>[]) : [];
  } catch {
    return [];
  }
}

function renderSubformTable(
  fields: SubformField[],
  entries: Record<string, string>[],
): string {
  if (entries.length === 0 || fields.length === 0) return "";
  const headers = fields
    .map(
      (f) =>
        `<th style="border:1px solid #cbd5e1;padding:6px 10px;background:#f1f5f9;text-align:left;font-size:12px;">${escapeHtml(f.label)}</th>`,
    )
    .join("");
  const rows = entries
    .map((e) => {
      const cells = fields
        .map(
          (f) =>
            `<td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;">${escapeHtml(String(e[f.id] ?? ""))}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;font-family:Arial,sans-serif;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Reemplaza placeholders ${campo} en un nombre de archivo y lo sanitiza:
 * - quita caracteres prohibidos en filesystems (Windows/Unix): / \ : * ? " < > |
 * - colapsa espacios múltiples
 * - limita a 200 caracteres (sin contar la extensión)
 * - garantiza la extensión .pdf
 *
 * El template puede venir vacío; en ese caso se devuelve fallback.
 */
export function renderFilename(
  template: string | undefined,
  data: Record<string, string>,
  fallback = "formulario.pdf",
): string {
  const raw = (template ?? "").trim();
  if (!raw) return fallback;

  const replaced = raw.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const v = (data[key] ?? "").toString();
    // Quitamos tags HTML (los valores expandidos de subform incluyen <br>)
    return v.replace(/<[^>]+>/g, " ");
  });

  // Separar extensión para no contarla en el límite ni perderla
  const dotIdx = replaced.lastIndexOf(".");
  let base = dotIdx > 0 ? replaced.slice(0, dotIdx) : replaced;
  const ext = dotIdx > 0 ? replaced.slice(dotIdx) : ".pdf";

  base = base
    // caracteres prohibidos en filesystems
    .replace(/[\\/:*?"<>|]/g, "_")
    // espacios múltiples y saltos de línea
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return fallback;
  if (base.length > 200) base = base.slice(0, 200);

  // Forzar extensión .pdf si no la tiene
  const safeExt = /^\.[a-z0-9]{1,5}$/i.test(ext) ? ext : ".pdf";
  return `${base}${safeExt.toLowerCase() === ".pdf" ? ".pdf" : safeExt}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
