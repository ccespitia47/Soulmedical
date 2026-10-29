import type { WidgetInstance } from "../types/widget.types";
import type { SubformField } from "../components/widgets/subform/subform.types";

export type AppPlaceholder = {
  placeholder: string;
  description: string;
  widgetType: string;
};

/**
 * LEGACY (lowercase sin espacios ni símbolos). Se mantiene exportado
 * porque `expandFormData` sigue emitiendo esta key en paralelo a la nueva
 * camelCase para que las plantillas antiguas (PDF/Email que ya tienen
 * `${nombredelpaciente}`, `${seleccionelapresentaciondextandi}`, etc.)
 * sigan resolviendo sin tocar nada. Nuevos placeholders usan `toCamelKey`.
 */
export function normalizeKey(label: string): string {
  return (label ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/gi, "");
}

/** Tope duro de longitud para keys autogeneradas desde un label. Si
 *  el label pasa este tope, `toCamelKey` corta por palabras completas
 *  (nunca en la mitad de una) hasta que el resultado quepa. Elegido
 *  en 30 porque arriba de ahí los chips se vuelven ilegibles y los
 *  mapers del PDF/Excel se descolocan visualmente. */
export const MAX_AUTO_KEY_LENGTH = 30;

/**
 * Normalización preferida (estilo MoreApp): acentos quitados y camelCase.
 *
 *   "Seleccione la presentacion de Xtandi" → "seleccioneLaPresentacionDeXtandi"
 *   "Dosis Prescrita"                       → "dosisPrescrita"
 *   "dosisPrescrita"                        → "dosisPrescrita" (preserva)
 *   "Nombre y Apellido del Prescriptor"     → "nombreYApellidoDelPrescriptor"
 *
 * Si el camelCase resultante supera `maxLen` caracteres (default 30),
 * se trunca sumando palabras completas hasta que la próxima no quepa.
 * Nunca corta en medio de una palabra para que el placeholder siga
 * siendo legible. La primera palabra siempre entra aunque sola supere
 * el tope — es mejor eso que una key vacía. Si el admin quiere
 * personalizar, puede setear `widget.placeholder` manualmente.
 *
 * Se usa para los placeholders que ve el admin (`buildPlaceholders`).
 * El motor de interpolación (`expandFormData`) emite TAMBIÉN la
 * variante legacy devuelta por `normalizeKey` para no romper
 * plantillas creadas antes de este cambio.
 */
export function toCamelKey(label: string, maxLen: number = MAX_AUTO_KEY_LENGTH): string {
  const cleaned = (label ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quitar acentos
  // Divide por separadores no alfanuméricos Y por bordes camelCase ya
  // existentes (ej. "dosisPrescrita" → ["dosis", "Prescrita"]) para no
  // perder el casing original cuando el label ya venía en camelCase.
  const tokens = cleaned.split(/[^a-zA-Z0-9]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  if (tokens.length === 0) return "";
  const toCamel = (ts: string[]): string => {
    const [first, ...rest] = ts;
    return (
      first.toLowerCase() +
      rest.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join("")
    );
  };
  const full = toCamel(tokens);
  if (full.length <= maxLen) return full;
  // Agregar tokens de a uno hasta que el siguiente no quepa. La primera
  // palabra siempre se incluye aunque sola exceda el tope.
  const kept: string[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    const candidate = toCamel([...kept, tokens[i]]);
    if (candidate.length > maxLen) break;
    kept.push(tokens[i]);
  }
  return toCamel(kept);
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
    // Si el admin definió un placeholder manual, lo usamos tal cual
    // (normalizado a camelCase por consistencia). Si no, derivamos de
    // toCamelKey(label) con desambiguación por sufijo. El `used` map
    // evita colisiones también entre manuales y automáticos (si alguien
    // pone "cargo" manual y hay otro widget con label "Cargo", el
    // segundo recibe `cargo1`).
    const manual = (w.placeholder ?? "").trim();
    const raw = manual ? toCamelKey(manual) : toCamelKey(w.label);
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
        const fRaw = toCamelKey(f.label);
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

    // Widgets `search`: por cada columna del Sheet (preferentemente
    // `sheetColumns` — importadas con el botón "Importar columnas del
    // Sheet" en Properties; fallback a `displayColumns` para widgets
    // creados antes de que ese campo existiera) agregamos `${base.col}`
    // en camelCase. El modal de resultados sigue decidiendo qué columnas
    // ver con `displayColumns`; esto es independiente — todas quedan
    // disponibles como placeholders.
    if (w.type === "search") {
      type Col = { key: string; label?: string };
      const sheetCols = (w.config?.sheetColumns as string[] | undefined) ?? [];
      const displayCols = (w.config?.displayColumns as Col[] | undefined) ?? [];
      const sources: string[] =
        sheetCols.length > 0 ? sheetCols : displayCols.map((c) => c.key).filter(Boolean);
      // Deduplicar por key original para no listar dos chips iguales si
      // sheetColumns y displayColumns se solapan en algún momento.
      const seen = new Set<string>();
      for (const sourceKey of sources) {
        if (!sourceKey || seen.has(sourceKey)) continue;
        seen.add(sourceKey);
        const colKey = toCamelKey(sourceKey);
        if (!colKey) continue;
        list.push({
          placeholder: `\${${base}.${colKey}}`,
          description: `${w.label}${descSuffix} → ${sourceKey}`,
          widgetType: w.type,
        });
      }
    }
  }
  return list;
}

/**
 * Devuelve un mapa { keyVieja: keyNueva } para migrar placeholders
 * `${…}` que estaban guardados en formato lowercase legacy (ej. en
 * plantillas PDF creadas antes del cambio a camelCase) hacia la clave
 * canónica actual. Cubre widgets normales, subformularios con sus
 * subcampos, y columnas del search (sheetColumns / displayColumns).
 *
 * Las entradas donde la key vieja ya coincide con la nueva se omiten
 * para que un `.replace()` ingenuo no desperdicie ciclos cambiando algo
 * por sí mismo.
 */
export function buildLegacyToCamelMap(
  widgets: Pick<WidgetInstance, "id" | "type" | "label" | "config" | "placeholder">[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Map<string, number>();
  const usedLegacy = new Map<string, number>();

  for (const w of widgets) {
    const manual = (w.placeholder ?? "").trim();
    const camelRaw = manual ? toCamelKey(manual) : toCamelKey(w.label);
    const legacyRaw = manual ? normalizeKey(manual) : normalizeKey(w.label);
    if (!camelRaw) continue;
    const camelKey = uniqueBaseKey(camelRaw, used);
    const legacyKey = legacyRaw ? uniqueBaseKey(legacyRaw, usedLegacy) : "";

    if (legacyKey && legacyKey !== camelKey) map[legacyKey] = camelKey;

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      // Variantes compuestas del subform (:tabla y .count).
      if (legacyKey && legacyKey !== camelKey) {
        map[`${legacyKey}:tabla`] = `${camelKey}:tabla`;
        map[`${legacyKey}.count`] = `${camelKey}.count`;
      }
      const usedField = new Map<string, number>();
      const usedFieldLegacy = new Map<string, number>();
      for (const f of fields) {
        const fCamel = toCamelKey(f.label);
        const fLegacy = normalizeKey(f.label);
        if (!fCamel) continue;
        const fk = uniqueBaseKey(fCamel, usedField);
        const fkLegacy = fLegacy ? uniqueBaseKey(fLegacy, usedFieldLegacy) : "";
        if (legacyKey && fkLegacy && (legacyKey !== camelKey || fkLegacy !== fk)) {
          map[`${legacyKey}.${fkLegacy}`] = `${camelKey}.${fk}`;
        }
      }
      continue;
    }

    if (w.type === "search") {
      type Col = { key: string; label?: string };
      const sheetCols = (w.config?.sheetColumns as string[] | undefined) ?? [];
      const displayCols = (w.config?.displayColumns as Col[] | undefined) ?? [];
      const sources: string[] =
        sheetCols.length > 0
          ? sheetCols
          : displayCols.map((c) => c.key).filter(Boolean);
      const seen = new Set<string>();
      for (const sourceKey of sources) {
        if (!sourceKey || seen.has(sourceKey)) continue;
        seen.add(sourceKey);
        const colCamel = toCamelKey(sourceKey);
        const colLegacy = normalizeKey(sourceKey);
        if (!colCamel) continue;
        if (
          legacyKey &&
          colLegacy &&
          (legacyKey !== camelKey || colLegacy !== colCamel)
        ) {
          map[`${legacyKey}.${colLegacy}`] = `${camelKey}.${colCamel}`;
        }
      }
    }
  }
  return map;
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
  // Doble emisión por valor: `set(baseCamel, valor)` + el equivalente en
  // la vieja normalización lowercase. Esto permite que plantillas creadas
  // antes del cambio a camelCase (que usan `${nombredelpaciente}`,
  // `${seleccionelapresentaciondextandi}`, etc.) sigan resolviendo sin
  // tocar nada. Mientras tanto, los chips nuevos muestran la variante
  // camelCase que es la "canónica" de ahora en adelante.
  const putDual = (base: string, legacyBase: string, value: string) => {
    out[base] = value;
    if (legacyBase && legacyBase !== base) out[legacyBase] = value;
  };
  // Mismo contador que buildPlaceholders — iterando sobre los widgets en el
  // MISMO orden la asignación queda sincronizada: el segundo widget "Cargo"
  // produce placeholder `${cargo1}` en buildPlaceholders y aquí recibe la
  // key `cargo1` → el mapper del PDF/Email encuentra el valor correcto.
  const used = new Map<string, number>();
  const usedLegacy = new Map<string, number>();

  for (const w of widgets) {
    if (hiddenIds?.has(w.id)) continue;
    const manual = (w.placeholder ?? "").trim();
    const raw = manual ? toCamelKey(manual) : toCamelKey(w.label);
    const legacyRaw = manual ? normalizeKey(manual) : normalizeKey(w.label);
    if (!raw) continue;
    const base = uniqueBaseKey(raw, used);
    const legacyBase = legacyRaw ? uniqueBaseKey(legacyRaw, usedLegacy) : "";
    const rawVal = data[w.id];

    if (w.type === "subform") {
      const fields = (w.config?.fields as SubformField[] | undefined) ?? [];
      const entries = parseSubformEntries(rawVal);
      const serial =
        typeof rawVal === "string" ? rawVal : JSON.stringify(entries);
      putDual(base, legacyBase, serial);
      putDual(`${base}:tabla`, legacyBase ? `${legacyBase}:tabla` : "", renderSubformTable(fields, entries));
      putDual(`${base}.count`, legacyBase ? `${legacyBase}.count` : "", String(entries.length));
      const usedField = new Map<string, number>();
      const usedFieldLegacy = new Map<string, number>();
      for (const f of fields) {
        const fRaw = toCamelKey(f.label);
        const fRawLegacy = normalizeKey(f.label);
        if (!fRaw) continue;
        const fk = uniqueBaseKey(fRaw, usedField);
        const fkLegacy = fRawLegacy ? uniqueBaseKey(fRawLegacy, usedFieldLegacy) : "";
        const value = entries
          .map((e) => escapeHtml(String(e[f.id] ?? "")))
          .filter(Boolean)
          .join("<br>");
        putDual(
          `${base}.${fk}`,
          legacyBase && fkLegacy ? `${legacyBase}.${fkLegacy}` : "",
          value,
        );
      }
      continue;
    }

    const valueStr =
      rawVal == null
        ? ""
        : typeof rawVal === "string"
        ? rawVal
        : JSON.stringify(rawVal);
    putDual(base, legacyBase, valueStr);

    // Widgets `search`: expone cada columna de la fila seleccionada bajo
    // `${base.col}`. La fila completa viaja como JSON en
    // `data["${widgetId}__row"]`. Si no hay fila (usuario no seleccionó
    // nada todavía), los sub-placeholders quedan vacíos. Fuente de
    // columnas: `sheetColumns` (importadas) > fallback `displayColumns`.
    if (w.type === "search") {
      type Col = { key: string; label?: string };
      const sheetCols = (w.config?.sheetColumns as string[] | undefined) ?? [];
      const displayCols = (w.config?.displayColumns as Col[] | undefined) ?? [];
      const sources: string[] =
        sheetCols.length > 0
          ? sheetCols
          : displayCols.map((c) => c.key).filter(Boolean);
      if (sources.length > 0) {
        const rowRaw = data[`${w.id}__row`];
        let row: Record<string, unknown> = {};
        if (typeof rowRaw === "string" && rowRaw) {
          try {
            const parsed = JSON.parse(rowRaw);
            if (parsed && typeof parsed === "object") {
              row = parsed as Record<string, unknown>;
            }
          } catch { /* fila inválida: columnas quedan vacías */ }
        }
        const seen = new Set<string>();
        for (const sourceKey of sources) {
          if (!sourceKey || seen.has(sourceKey)) continue;
          seen.add(sourceKey);
          const colCamel = toCamelKey(sourceKey);
          const colLegacy = normalizeKey(sourceKey);
          if (!colCamel) continue;
          const v = row[sourceKey];
          const vs =
            v == null ? "" : typeof v === "string" ? v : String(v);
          putDual(
            `${base}.${colCamel}`,
            legacyBase && colLegacy ? `${legacyBase}.${colLegacy}` : "",
            vs,
          );
        }
      }
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
