import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function SearchRender({ widget, onValue }: WidgetRenderProps) {
  const config = widget.config as SearchWidgetConfig;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedDisplay, setSelectedDisplay] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Coordenadas del dropdown en viewport para portalizar a document.body y
  // evitar recortes por contenedores padre con overflow:hidden/auto.
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const minChars = config.minChars ?? 2;
  const columns = config.displayColumns ?? [];

  const doSearch = useCallback(async (q: string) => {
    if (q.length < minChars) { setResults([]); setShowDropdown(false); return; }
    setLoading(true);
    try {
      const rows = await searchSource(config, q);
      setResults(rows);
      setShowDropdown(rows.length > 0);
    } catch (e) {
      console.error("[SearchWidget] Error buscando:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [config, minChars]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Recalcula la posición del dropdown cuando abre o cuando cambia el layout
  // (scroll, resize). Portalizar a document.body evita clipping por overflow
  // de contenedores padre, pero requiere reposicionar manualmente.
  useLayoutEffect(() => {
    if (!showDropdown) { setDropdownRect(null); return; }
    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showDropdown]);

  const handleSelect = (row: Row) => {
    const display = getDisplayValue(row, config);
    const value = display;
    setSelectedDisplay(display);
    setSelectedValue(value);
    setQuery(display);
    setShowDropdown(false);
    setShowModal(false);

    // Rellenar otros campos via onValue
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

  const handleClear = () => {
    setQuery(""); setSelectedValue(""); setSelectedDisplay("");
    setResults([]); setShowDropdown(false);
    if (onValue) onValue({ [widget.id]: "" });
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>

      {/* Input oculto para el submit del formulario */}
      <input type="hidden" name={widget.id} value={selectedValue} />

      <div className="relative flex items-center">
        <span className="absolute left-3 text-gray-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={(config.placeholder as string) || "Buscar..."}
          onChange={(e) => { setQuery(e.target.value); setSelectedValue(""); }}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white py-2 pl-9 pr-20 text-[13.5px] text-gray-900 outline-none focus:border-[#00c2a8]"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && <span className="text-xs text-gray-400">⏳</span>}
          {selectedValue && (
            <button type="button" onClick={handleClear}
              className="cursor-pointer rounded border-none bg-slate-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              ✕
            </button>
          )}
          {columns.length > 0 && (
            <button type="button"
              onClick={() => { if (query.length >= minChars) { doSearch(query); setShowModal(true); } }}
              className="cursor-pointer rounded border-none bg-[#00c2a8] px-2 py-0.5 text-[11px] font-bold text-white">
              Ver más
            </button>
          )}
        </div>
      </div>

      {/* Badge de seleccionado */}
      {selectedDisplay && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1">
          <span className="text-xs text-emerald-600">✓</span>
          <span className="text-[12px] font-semibold text-emerald-800">{selectedDisplay}</span>
        </div>
      )}

      {/* Dropdown de sugerencias — portalizado a document.body para que ningún
          contenedor padre con overflow:hidden/auto lo recorte. */}
      {showDropdown && results.length > 0 && dropdownRect && createPortal(
        <div
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
          }}
          className="max-h-[260px] overflow-y-auto rounded-[10px] border-2 border-[#00c2a8] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
        >
          {results.slice(0, 8).map((row, i) => (
            <div key={i}
              onMouseDown={() => handleSelect(row)}
              className="cursor-pointer border-b border-slate-100 px-4 py-3 text-[13px] last:border-b-0 hover:bg-emerald-50"
            >
              <span className="font-semibold text-gray-900">{getDisplayValue(row, config)}</span>
              {columns.length > 1 && (
                <span className="ml-2 text-[11px] text-gray-400">
                  {columns.slice(1, 3).map((c) => row[c.key] ? `${c.label}: ${row[c.key]}` : "").filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          ))}
          {results.length > 8 && (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <button onMouseDown={() => { setShowDropdown(false); setShowModal(true); }}
                className="cursor-pointer border-none bg-transparent text-[12px] font-semibold text-[#00c2a8]">
                Ver los {results.length} resultados →
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* Modal de resultados */}
      {showModal && (
        <ResultsModal
          results={results}
          columns={columns.length > 0 ? columns : [{ key: Object.keys(results[0] ?? {})[0] ?? "value", label: "Resultado" }]}
          query={query}
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
