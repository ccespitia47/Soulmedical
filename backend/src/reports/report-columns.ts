// Construcción de columnas del reporte xlsx.
//
// La mayoría de widgets se exportan como una sola columna (valor plano). El
// widget `subform` es especial: su valor en `submission.data[widgetId]` es un
// string JSON con un arreglo de entradas (`SubformEntry[]`), y cada entrada es
// un objeto keyed por el id de los campos internos. Además los campos internos
// multi-valor (checkbox) guardan a su vez un arreglo JSON (`["Opción 1"]`).
//
// Para que el reporte salga "desplegado en columnas", cada campo interno del
// subformulario se convierte en su propia columna. Si algún envío tiene varias
// entradas, se generan columnas numeradas por entrada (`#1`, `#2`, ...).

export type ReportWidget = {
  id: string;
  label: string;
  type: string;
  config?: Record<string, unknown>;
};

type SubformInnerField = { id: string; label: string; type?: string };

export type ReportColumn = {
  header: string;
  key: string;
  value: (data: Record<string, unknown> | undefined) => string;
  // Si true, la celda se genera con alignment.wrapText en ExcelJS para
  // que los \n del contenido se muestren como saltos reales dentro de la celda.
  // Aplica a widgets tipo textarea.
  wrapText?: boolean;
};

/** Convierte un valor arbitrario en texto plano para una celda. */
export function stringifyCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Aplana el valor de un campo interno del subformulario. Los campos multi-valor
 * (checkbox / multi-select) llegan como un arreglo JSON string; el resto llega
 * como string plano.
 */
export function formatSubformCell(raw: unknown): string {
  if (raw == null) return '';
  const s = typeof raw === 'string' ? raw : String(raw);
  const t = s.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).join(', ');
    } catch {
      // No era JSON; se devuelve tal cual.
    }
  }
  return s;
}

/** Parsea el valor crudo de un subformulario a su arreglo de entradas. */
export function parseSubformEntries(raw: unknown): Record<string, string>[] {
  if (Array.isArray(raw)) return raw as Record<string, string>[];
  if (typeof raw !== 'string') return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    const parsed: unknown = JSON.parse(t);
    return Array.isArray(parsed) ? (parsed as Record<string, string>[]) : [];
  } catch {
    return [];
  }
}

/** Lee los campos internos definidos en el esquema de un subformulario. */
export function getSubformInnerFields(widget: ReportWidget): SubformInnerField[] {
  const fields = widget.config?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter(
      (x): x is SubformInnerField =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as { id?: unknown }).id === 'string' &&
        typeof (x as { label?: unknown }).label === 'string',
    )
    .map((x) => ({ id: x.id, label: x.label, type: x.type }));
}

/** Cuenta cuántas entradas tiene el subformulario en un envío dado. */
export function countSubformEntries(raw: unknown): number {
  return parseSubformEntries(raw).length;
}

/**
 * Construye la lista de columnas del reporte. `maxEntriesByWidget` indica, por
 * cada widget subformulario, el número máximo de entradas observado en los
 * envíos (para saber cuántas columnas por entrada generar).
 */
export function buildReportColumns(
  fields: ReportWidget[],
  maxEntriesByWidget: Record<string, number>,
): ReportColumn[] {
  const cols: ReportColumn[] = [];

  for (const f of fields) {
    const inner = f.type === 'subform' ? getSubformInnerFields(f) : [];

    if (f.type === 'subform' && inner.length > 0) {
      const widgetId = f.id;
      // Al menos una entrada para que la estructura del subformulario siempre
      // aparezca, aunque ningún envío tenga datos todavía.
      const count = Math.max(1, maxEntriesByWidget[widgetId] ?? 0);

      for (let e = 0; e < count; e++) {
        const entryIndex = e;
        for (const field of inner) {
          const fieldId = field.id;
          const header =
            count > 1
              ? `${f.label} #${e + 1} - ${field.label}`
              : `${f.label} - ${field.label}`;
          cols.push({
            header,
            key: `${widgetId}::${entryIndex}::${fieldId}`,
            value: (data) => {
              const entries = parseSubformEntries(data?.[widgetId]);
              return formatSubformCell(entries[entryIndex]?.[fieldId]);
            },
          });
        }
      }
    } else {
      const widgetId = f.id;
      cols.push({
        header: f.label,
        key: widgetId,
        value: (data) => stringifyCell(data?.[widgetId]),
        wrapText: f.type === 'textarea',
      });
    }
  }

  return cols;
}
