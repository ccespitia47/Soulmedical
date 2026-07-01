import type { CellData } from "../../../utils/excelParser";
import { COL_LETTERS, COL_WIDTHS, decodeCol } from "../../../utils/excelParser";
import type { ExcelFieldMapping } from "../../../types/email-template.types";
import type { PlaceholderItem } from "./PlaceholdersList";

const LEGEND = [
  { bg: "#f0fdf8", bd: "#bbf7d0", label: "Encabezado" },
  { bg: "#fff", bd: "#e2e8f0", label: "Celda disponible" },
  { bg: "#eff6ff", bd: "#3b82f6", label: "Hover (al seleccionar)" },
  { bg: "#f0fdf4", bd: "#22c55e", label: "Campo mapeado" },
];

type ExcelTableProps = {
  rows: CellData[][];
  mappings: Record<string, ExcelFieldMapping>;
  selectedPlaceholder: PlaceholderItem | null;
  hoveredCell: string | null;
  customLogo: string | null;
  embeddedImages: { col: number; row: number }[];
  onHover: (coord: string | null) => void;
  onCellClick: (cell: CellData) => void;
  onRemoveMapping: (coord: string) => void;
};

function cellStyle(
  cell: CellData,
  mapped: boolean,
  hovered: boolean,
  selectedPlaceholder: PlaceholderItem | null
): React.CSSProperties {
  const structural = cell.row <= 5 || cell.row >= 24;
  let bg = structural ? "#f0fdf8" : "#ffffff";
  let border = "1px solid #e2e8f0";
  let color = structural ? "#064e3b" : "#1e293b";

  if (cell.isMappable && hovered && selectedPlaceholder && !mapped) {
    bg = "#eff6ff";
    border = "2px solid #3b82f6";
  }
  if (mapped) {
    bg = "#f0fdf4";
    border = "2px solid #22c55e";
    color = "#14532d";
  }

  return {
    padding: "3px 6px",
    border,
    backgroundColor: bg,
    color,
    fontWeight: cell.style.bold ? 700 : 400,
    fontSize: 10.5,
    textAlign: cell.style.align,
    cursor:
      cell.isMappable && selectedPlaceholder ? "crosshair" : mapped ? "pointer" : "default",
    verticalAlign: "middle",
    wordBreak: "break-word",
    lineHeight: 1.3,
    transition: "background 0.12s, border 0.12s",
  };
}

export default function ExcelTable({
  rows,
  mappings,
  selectedPlaceholder,
  hoveredCell,
  customLogo,
  embeddedImages,
  onHover,
  onCellClick,
  onRemoveMapping,
}: ExcelTableProps) {
  const logoForCell = (colLetter: string, rowNum: number): string | null => {
    if (!customLogo) return null;
    const c = decodeCol(colLetter);
    const hasOriginal = embeddedImages.some((img) => img.col === c && img.row === rowNum - 1);
    return hasOriginal ? customLogo : null;
  };

  return (
    <>
      <div className="mb-2.5 flex w-fit flex-wrap gap-3.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-[10.5px] text-slate-500">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[11px] w-[11px] flex-shrink-0 rounded-sm"
              style={{ background: l.bg, border: `2px solid ${l.bd}` }}
            />
            {l.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <table className="border-collapse text-[10.5px]" style={{ tableLayout: "fixed", minWidth: 960 }}>
          <colgroup>
            {COL_LETTERS.map((col) => (
              <col key={col} style={{ width: COL_WIDTHS[col] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COL_LETTERS.map((col) => (
                <th
                  key={col}
                  className="border-b-2 border-r border-slate-200 border-r-slate-100 bg-slate-50 px-1.5 py-1 text-center text-[10px] font-bold tracking-[0.5px] text-slate-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell) => {
                  const mapped = mappings[cell.coord];
                  const isMapped = !!mapped;
                  const hovered = hoveredCell === cell.coord;
                  const logoSrc = logoForCell(cell.col, cell.row);

                  return (
                    <td
                      key={cell.coord}
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                      style={cellStyle(cell, isMapped, hovered, selectedPlaceholder)}
                      onClick={() => onCellClick(cell)}
                      onMouseEnter={() => cell.isMappable && onHover(cell.coord)}
                      onMouseLeave={() => onHover(null)}
                      title={
                        cell.isMappable
                          ? mapped
                            ? `Mapeado: ${mapped.placeholder} — clic en ✕ para quitar`
                            : selectedPlaceholder
                            ? `Asignar aquí: ${selectedPlaceholder.placeholder}`
                            : "Selecciona un campo del panel izquierdo"
                          : cell.value || ""
                      }
                    >
                      {logoSrc && (
                        <div className="py-0.5 text-center">
                          <img
                            src={logoSrc}
                            alt="logo"
                            className="mx-auto block max-h-[52px] max-w-[90%] object-contain"
                          />
                        </div>
                      )}

                      {mapped ? (
                        <div>
                          <div className="mb-0.5 inline-flex items-center gap-1 rounded font-mono text-[9.5px] text-emerald-900"
                               style={{ background: "#bbf7d0", padding: "1px 5px" }}>
                            {mapped.placeholder}
                          </div>
                          {cell.value && (
                            <div className="text-[9px] italic text-slate-400">
                              {cell.value}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveMapping(cell.coord);
                            }}
                            className="mt-0.5 block cursor-pointer rounded border border-red-300 bg-red-100 px-1.5 py-px text-[9px] text-red-600"
                          >
                            ✕ Quitar
                          </button>
                        </div>
                      ) : (
                        !logoSrc && <span>{cell.value}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
        <span>💡</span>
        <span>
          Los colores de esta vista son solo para el mapeo. El PDF generado tendrá
          <strong> fondo blanco</strong> con el formato original del Excel, sin ningún color de
          marcación.
        </span>
      </div>
    </>
  );
}
