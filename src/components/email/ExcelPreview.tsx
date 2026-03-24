import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";

type PlaceholderItem = {
  placeholder: string;
  description: string;
};

type CellData = {
  coord: string;
  col: string;
  row: number;
  value: string;
  rowspan: number;
  colspan: number;
  isData: boolean; // filas de datos (6-23) o cabecera dinámica (4)
  style: {
    align: "left" | "center" | "right";
    bold: boolean;
    fontSize: number;
    wrapText: boolean;
    bgColor?: string;
    color?: string;
  };
};

type ColDim = { width: number };
type RowDim = { height: number };

type ExcelPreviewProps = {
  excelBase64: string;
  mappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  customLogoBase64?: string;
  // Valores reales del formulario (cuando viene de un envío real)
  // Si no se pasan, se usan valores de ejemplo para la vista previa
  formValues?: Record<string, string>;
  onClose: () => void;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAPPABLE_ROWS = new Set([4, ...Array.from({ length: 18 }, (_, i) => i + 6)]);

// Celdas centradas (extraído del formato real)
const CENTER_CELLS = new Set([
  "C1", "A5", "G5",
  "A24", "B24", "C24", "G24",
  "A25", "B25", "C25",
  "E26", "G26", "I26", "G27",
]);

// Factor de conversión: unidad de carácter Excel (~7px) a px
const CHAR_TO_PX = 7;
const ROW_PX = 18; // altura por defecto en px

// ─── Helpers ─────────────────────────────────────────────────────────────────

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return [
    d.getUTCDate().toString().padStart(2, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("-");
}

function parseExcel(base64: string): {
  rows: CellData[][];
  colWidths: Record<string, number>;
  rowHeights: Record<number, number>;
} {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const wb = XLSX.read(raw, { type: "base64" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Merged cells
  const mergedMap: Record<string, { rowspan: number; colspan: number }> = {};
  const mergedSkip = new Set<string>();
  for (const m of ((ws["!merges"] as XLSX.Range[]) || [])) {
    const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    mergedMap[tl] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) {
        const coord = XLSX.utils.encode_cell({ r, c });
        if (coord !== tl) mergedSkip.add(coord);
      }
  }

  // Anchos de columna
  const colWidths: Record<string, number> = {};
  const colsInfo = (ws["!cols"] as ColDim[] | undefined) || [];
  const defaultCols: Record<string, number> = {
    A: 100, B: 150, C: 110, D: 115, E: 110,
    F: 135, G: 170, H: 180, I: 185,
  };
  ["A", "B", "C", "D", "E", "F", "G", "H", "I"].forEach((col, i) => {
    const w = colsInfo[i]?.width;
    colWidths[col] = w ? Math.round(w * CHAR_TO_PX) : defaultCols[col];
  });

  // Alturas de fila
  const rowHeights: Record<number, number> = {};
  const rowsInfo = (ws["!rows"] as RowDim[] | undefined) || [];
  for (let i = 0; i < 27; i++) {
    const h = rowsInfo[i]?.height;
    rowHeights[i + 1] = h ? Math.round(h * 1.33) : ROW_PX; // pt → px aprox
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I27");
  const rows: CellData[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowArr: CellData[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const coord = XLSX.utils.encode_cell({ r, c });
      if (mergedSkip.has(coord)) continue;

      const cell = ws[coord];
      const colLetter = XLSX.utils.encode_col(c);
      const rowNum = r + 1;
      const merge = mergedMap[coord] || { rowspan: 1, colspan: 1 };

      let value = "";
      if (cell?.v !== undefined && cell.v !== null) {
        if (typeof cell.v === "number" && cell.v > 40000 && cell.v < 60000 && cell.t === "n")
          value = excelSerialToDate(cell.v);
        else
          value = String(cell.v);
      }

      const isBold = rowNum <= 5 || rowNum >= 24;
      const isCenter = CENTER_CELLS.has(coord);

      rowArr.push({
        coord,
        col: colLetter,
        row: rowNum,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        isData: MAPPABLE_ROWS.has(rowNum),
        style: {
          align: isCenter ? "center" : "left",
          bold: isBold,
          fontSize: rowNum === 1 ? 11 : 10,
          wrapText: true,
          bgColor: (rowNum <= 5 || rowNum >= 24) ? "#e6f4f1" : "#ffffff",
          color: "#000000",
        },
      });
    }
    rows.push(rowArr);
  }

  return { rows, colWidths, rowHeights };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ExcelPreview({
  excelBase64,
  mappings,
  availablePlaceholders,
  customLogoBase64,
  formValues,
  onClose,
}: ExcelPreviewProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<CellData[][]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapa: placeholder → valor a mostrar
  const valueMap = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      const parsed = parseExcel(excelBase64);
      setRows(parsed.rows);
      setColWidths(parsed.colWidths);
      setRowHeights(parsed.rowHeights);

      // Construir mapa de valores
      const vm: Record<string, string> = {};
      for (const p of availablePlaceholders) {
        if (formValues && formValues[p.placeholder] !== undefined) {
          vm[p.placeholder] = formValues[p.placeholder];
        } else {
          // Valor de ejemplo para la vista previa
          vm[p.placeholder] = `[${p.description}]`;
        }
      }
      valueMap.current = vm;
    } catch (e) {
      setError("No se pudo cargar el Excel para la vista previa.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [excelBase64, mappings, availablePlaceholders, formValues]);

  // Resolver el valor de una celda: si tiene mapping, inyectar el valor
  const resolveValue = (coord: string, originalValue: string): string => {
    const mapping = mappings.find((m) => m.coord === coord);
    if (!mapping) return originalValue;
    return valueMap.current[mapping.placeholder] ?? originalValue;
  };

  // ─── Exportar a PDF ────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;

      // Tamaño de página: A4 landscape si es muy ancho, portrait si no
      const isLandscape = imgW > imgH;
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "px",
        format: "a4",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      const scale = Math.min(maxW / imgW, maxH / imgH);
      const finalW = imgW * scale;
      const finalH = imgH * scale;

      pdf.addImage(imgData, "PNG", margin, margin, finalW, finalH);
      pdf.save("formulario.pdf");
    } catch (e) {
      alert("Error al generar el PDF. Intenta de nuevo.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.8)",
      zIndex: 500,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#f1f5f9",
        borderRadius: 16,
        width: "100%", maxWidth: 1100, maxHeight: "95vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "14px 24px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>📄</div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Vista Previa del PDF
              </h2>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                {formValues
                  ? "Datos reales del formulario"
                  : "Los valores entre [ ] son de ejemplo — así se verá al enviar"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleExportPDF}
              disabled={exporting || loading}
              style={{
                padding: "8px 18px",
                background: exporting ? "#94a3b8" : "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: exporting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: exporting ? "none" : "0 2px 8px rgba(239,68,68,0.35)",
                transition: "all 0.2s",
              }}
            >
              {exporting ? "⏳ Generando..." : "⬇️ Descargar PDF"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9", border: "none", borderRadius: 8,
                width: 32, height: 32, fontSize: 16, color: "#64748b",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>
        </div>

        {/* ── Body: tabla de preview ── */}
        <div style={{
          flex: 1, overflowY: "auto", overflowX: "auto",
          padding: "24px",
          display: "flex", justifyContent: "center",
          background: "#f1f5f9",
        }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", color: "#64748b", gap: 8 }}>
              ⏳ Cargando vista previa...
            </div>
          )}
          {error && (
            <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626" }}>
              ❌ {error}
            </div>
          )}

          {!loading && !error && (
            /* Este div es el que se captura con html2canvas */
            <div
              ref={tableRef}
              style={{
                background: "#ffffff",
                padding: "12px",
                borderRadius: 4,
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                display: "inline-block",
              }}
            >
              <table style={{
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontFamily: "Arial, sans-serif",
                fontSize: 10,
              }}>
                <colgroup>
                  {["A","B","C","D","E","F","G","H","I"].map((col) => (
                    <col key={col} style={{ width: colWidths[col] || 100 }} />
                  ))}
                </colgroup>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ height: rowHeights[row[0]?.row] || ROW_PX }}>
                      {row.map((cell) => {
                        const displayValue = resolveValue(cell.coord, cell.value);
                        const isMapped = mappings.some((m) => m.coord === cell.coord);
                        const isLogoCell = customLogoBase64 && cell.coord === "A1";

                        return (
                          <td
                            key={cell.coord}
                            colSpan={cell.colspan}
                            rowSpan={cell.rowspan}
                            style={{
                              border: "1px solid #9ca3af",
                              padding: "2px 4px",
                              backgroundColor: "#ffffff", // siempre blanco — sin colores de UI
                              color: "#000000",
                              fontWeight: cell.style.bold ? 700 : 400,
                              fontSize: cell.style.fontSize,
                              textAlign: cell.style.align,
                              verticalAlign: "middle",
                              wordBreak: "break-word",
                              lineHeight: 1.3,
                              // Resaltar celdas mapeadas con un borde más visible (solo en preview)
                              outline: isMapped ? "2px solid #00c2a8" : "none",
                              outlineOffset: "-2px",
                            }}
                          >
                            {/* Logo personalizado */}
                            {isLogoCell ? (
                              <img
                                src={customLogoBase64}
                                alt="logo"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: 50,
                                  display: "block",
                                  margin: "0 auto",
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              <span style={{
                                color: isMapped && !formValues ? "#0369a1" : "#000000",
                                fontStyle: isMapped && !formValues ? "italic" : "normal",
                              }}>
                                {displayValue}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "10px 24px",
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, color: "#64748b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                display: "inline-block", width: 10, height: 10,
                border: "2px solid #00c2a8", borderRadius: 1,
              }} />
              Celda con campo mapeado
            </span>
            {!formValues && (
              <span style={{ color: "#0369a1", fontStyle: "italic" }}>
                [Texto entre corchetes] = valor de ejemplo
              </span>
            )}
          </div>
          <span style={{ color: "#94a3b8" }}>
            El PDF generado tendrá fondo blanco y sin marcas de color
          </span>
        </div>
      </div>
    </div>
  );
}