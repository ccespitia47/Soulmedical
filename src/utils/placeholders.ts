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
 * Asigna una key única agregando sufijo numérico determinístico cuando el
 * mismo `base` ya fue usado antes. La primera aparición va sin sufijo
 * (`cargo`), la segunda `cargo1`, la tercera `cargo2`, etc. — tal como el
 * usuario pidió: "cargo, cargo 1, cargo 2".
 *
 * `used` se MUTA en cada llamada: contador por base. Debe compartirse entre
 * buildPlaceholders y expandFormData usando el MISMO orden de widgets para
 * que `data["cargo1"]` apunte efectivamente al segundo widget "Cargo".
 */
function uniqueBaseKey(base: string, used: Map<string, number>): string {
  const current = used.get(base) ?? 0;
  used.set(base, current + 1);
  return current === 0 ? base : `${base}${current}`;
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
  widgets: Pick<WidgetInstance, "type" | "label" | "config" | "placeholder">[],
): AppPlaceholder[] {
  const list: AppPlaceholder[] = [];
  const used = new Map<string, number>();
  // Contador por posición para enriquecer la descripción con "(#N)" cuando
  // haya duplicados, así el admin puede distinguir qué widget es cuál en el
  // mapper del PDF/Email aunque los labels sean idénticos.
  const occurrenceByLabel = new Map<string, number>();

  for (const w of widgets) {
    // Si el admin definió un placeholder manual, lo usamos (normalizado por
    // consistencia). Si no, caemos a normalizeKey(label) con desambiguación
    // por sufijo. El `used` map evita colisiones también entre manuales y
    // automáticos (si alguien pone "cargo" manual y hay otro widget con
    // label "Cargo", el segundo recibe `cargo1`).
    const manual = (w.placeholder ?? "").trim();
    const raw = manual ? normalizeKey(manual) : normalizeKey(w.label);
    if (!raw) continue;
    const base = uniqueBaseKey(raw, used);
    const occ = (occurrenceByLabel.get(w.label) ?? 0) + 1;
    occurrenceByLabel.set(w.label, occ);
    const totalWithSameLabel = widgets.filter((x) => x.label === w.label).length;
    const descSuffix = totalWithSameLabel > 1 ? ` (#${occ})` : "";

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      list.push({
        placeholder: `\${${base}:tabla}`,
        description: `${w.label}${descSuffix} (tabla con todas las entradas)`,
        widgetType: w.type,
      });
      // Para los subcampos del subform usamos un contador propio por subform
      // para que `${base.cargo}` y `${base.cargo1}` desambigüen cuando hay
      // dos SubformFields con el mismo label dentro del mismo subform.
      const usedField = new Map<string, number>();
      for (const f of fields) {
        const fRaw = normalizeKey(f.label);
        if (!fRaw) continue;
        const fk = uniqueBaseKey(fRaw, usedField);
        list.push({
          placeholder: `\${${base}.${fk}}`,
          description: `${w.label}${descSuffix} → ${f.label}`,
          widgetType: w.type,
        });
      }
      list.push({
        placeholder: `\${${base}.count}`,
        description: `${w.label}${descSuffix} (número de entradas)`,
        widgetType: w.type,
      });
      continue;
    }

    list.push({
      placeholder: `\${${base}}`,
      description: `${w.label}${descSuffix}`,
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
  widgets: Pick<WidgetInstance, "id" | "type" | "label" | "config" | "placeholder">[],
  data: Record<string, unknown>,
  hiddenIds?: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  // Mismo contador que buildPlaceholders — iterando sobre los widgets en el
  // MISMO orden la asignación queda sincronizada: el segundo widget "Cargo"
  // produce placeholder `${cargo1}` en buildPlaceholders y aquí recibe la
  // key `cargo1` → el mapper del PDF/Email encuentra el valor correcto.
  const used = new Map<string, number>();

  for (const w of widgets) {
    if (hiddenIds?.has(w.id)) continue;
    const manual = (w.placeholder ?? "").trim();
    const raw = manual ? normalizeKey(manual) : normalizeKey(w.label);
    if (!raw) continue;
    const base = uniqueBaseKey(raw, used);
    const rawVal = data[w.id];

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      const entries = parseSubformEntries(rawVal);
      out[base] = typeof rawVal === "string" ? rawVal : JSON.stringify(entries);
      out[`${base}:tabla`] = renderSubformTable(fields, entries);
      out[`${base}.count`] = String(entries.length);
      const usedField = new Map<string, number>();
      for (const f of fields) {
        const fRaw = normalizeKey(f.label);
        if (!fRaw) continue;
        const fk = uniqueBaseKey(fRaw, usedField);
        out[`${base}.${fk}`] = entries
          .map((e) => escapeHtml(String(e[f.id] ?? "")))
          .filter(Boolean)
          .join("<br>");
      }
      continue;
    }

    if (rawVal == null) {
      out[base] = "";
    } else if (typeof rawVal === "string") {
      out[base] = rawVal;
    } else {
      out[base] = JSON.stringify(rawVal);
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

/**
 * formData listo para el envío de email. Combina DOS familias de claves:
 *
 *   - por widgetId  → las usa el backend para resolver los destinatarios
 *                     `type: 'field'` (`formData[recipient.widgetId]`).
 *   - por label normalizado → las usan los `${placeholders}` del asunto y del
 *                     cuerpo (lo que ya hacía `expandFormData`).
 *
 * Sin las primeras, un destinatario "campo del formulario" nunca resuelve y se
 * descarta en silencio; si era el único en "Para", el envío falla entero con
 * "No hay destinatarios válidos". El camino público (backend
 * `forms.service.ts`) ya mandaba ambas — esto alinea el camino autenticado.
 *
 * Los widgets ocultos por reglas se omiten en AMBAS familias: si el campo no
 * se mostró, su valor no debe acabar ni en el cuerpo ni como destinatario.
 */
export function buildEmailFormData(
  widgets: Pick<WidgetInstance, "id" | "type" | "label" | "config" | "placeholder">[],
  data: Record<string, unknown>,
  hiddenIds?: Set<string>,
): Record<string, string> {
  const byWidgetId: Record<string, string> = {};
  for (const w of widgets) {
    if (hiddenIds?.has(w.id)) continue;
    const raw = data[w.id];
    if (raw == null) continue;
    byWidgetId[w.id] = typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  // Las claves por label van al final: ante una colisión improbable, mandan
  // ellas (son las que alimentan los placeholders visibles).
  return { ...byWidgetId, ...expandFormData(widgets, data, hiddenIds) };
}
