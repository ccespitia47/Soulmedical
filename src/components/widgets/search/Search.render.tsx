import { useCallback, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import type { SearchWidgetConfig } from "./search.types";
import { searchFormSubmissions } from "./sources/formSubmissions";
import { searchGroup } from "./sources/group";
import { searchGoogleSheets } from "./sources/googleSheets";
import { searchExcelWeb } from "./sources/excelWeb";
import { searchSQL } from "./sources/sql";
import ResultsModal from "./ResultsModal";

type Row = Record<string, unknown>;

async function searchSource(config: SearchWidgetConfig, q: string): Promise<Row[]> {
  switch (config.sourceType) {
    case "form_submissions": return searchFormSubmissions(config, q);
    case "group": return searchGroup(config, q);
    case "google_sheets": return searchGoogleSheets(config, q);
    case "excel_web": return searchExcelWeb(config, q);
    case "sql": return searchSQL(config, q);
    default: return [];
  }
}

function getDisplayValue(row: Row, config: SearchWidgetConfig): string {
  if (config.displayField && row[config.displayField] != null) return String(row[config.displayField]);
  const firstCol = config.displayColumns?.[0]?.key;
  if (firstCol && row[firstCol] != null) return String(row[firstCol]);
  const firstKey = Object.keys(row)[0];
  return firstKey ? String(row[firstKey]) : "";
}

export default function SearchRender({ widget, onValue }: WidgetRenderProps) {
  const config = widget.config as SearchWidgetConfig;
  const [showModal, setShowModal] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedDisplay, setSelectedDisplay] = useState("");

  const minChars = config.minChars ?? 2;
  const columns = config.displayColumns ?? [];

  // Adapter que el modal invoca en cada tecla (con su propio debounce).
  const runSearch = useCallback(
    async (q: string): Promise<Row[]> => {
      try { return await searchSource(config, q); }
      catch (e) { console.error("[SearchWidget] Error buscando:", e); return []; }
    },
    [config],
  );

  const handleSelect = (row: Row) => {
    const display = getDisplayValue(row, config);
    const value = display;
    setSelectedDisplay(display);
    setSelectedValue(value);
    setShowModal(false);

    // Rellenar otros campos (widgets top-level + sub-campos de subforms).
    // FormPage.handleWidgetValues detecta 'subformId:fieldId' y dispara el
    // CustomEvent 'subform:fill' que consume Subform.render.
    if (onValue && (config.fieldMappings ?? []).length > 0) {
      const fill: Record<string, string> = { [widget.id]: value };
      for (const m of config.fieldMappings!) {
        if (m.targetWidgetId && m.sourceField) {
          fill[m.targetWidgetId] = String(row[m.sourceField] ?? "");
        }
      }
      onValue(fill);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValue("");
    setSelectedDisplay("");
    if (onValue) onValue({ [widget.id]: "" });
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>

      {/* Input oculto para el submit del formulario */}
      <input type="hidden" name={widget.id} value={selectedValue} />

      {/* Trigger: al hacer clic abre el modal de búsqueda. */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 text-left text-[13.5px] outline-none hover:border-[#00c2a8] focus:border-[#00c2a8]"
      >
        <span className="text-gray-400">🔍</span>
        {selectedDisplay ? (
          <span className="flex-1 truncate font-medium text-gray-900">{selectedDisplay}</span>
        ) : (
          <span className="flex-1 truncate text-gray-400">
            {(config.placeholder as string) || "Buscar..."}
          </span>
        )}
        {selectedValue && (
          <span
            onClick={handleClear}
            className="cursor-pointer rounded border-none bg-slate-100 px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-slate-200"
            role="button"
            aria-label="Limpiar selección"
          >
            ✕
          </span>
        )}
      </button>

      {showModal && (
        <ResultsModal
          columns={columns}
          fallbackKey={config.displayField ?? undefined}
          initialQuery=""
          minChars={minChars}
          onSearch={runSearch}
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
