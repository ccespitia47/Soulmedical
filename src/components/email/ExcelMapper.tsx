import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";

// Re-exportar para que EmailConfigPanel pueda importarlo desde aquí si lo necesita
export type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CellStyle = {
  align: "left" | "center" | "right";
  bold: boolean;
  wrapText: boolean;
};

type CellData = {
  coord: string;
  col: string;
  row: number;
  value: string;
  rowspan: number;
  colspan: number;
  isMappable: boolean;
  style: CellStyle;
};

type PlaceholderItem = {
  placeholder: string;
  description: string;
  widgetType?: string;
};

type EmbeddedImage = {
  b64: string;   // data:image/png;base64,...
  col: number;   // 0-based
  row: number;   // 0-based
};

type ExcelMapperProps = {
  excelBase64: string;
  existingMappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  onSave: (mappings: ExcelMapping[], logoBase64?: string) => void;
  onClose: () => void;
};

// ─── Anchos de columna (en px, proporcionales al Excel) ───────────────────────
const COL_WIDTHS: Record<string, number> = {
  A: 100, B: 150, C: 110, D: 115, E: 110,
  F: 135, G: 170, H: 180, I: 185,
};

// Filas mapeables (4 = cabecera dinámica, 6-23 = datos)
const MAPPABLE_ROWS = new Set([4, ...Array.from({ length: 18 }, (_, i) => i + 6)]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return [
    d.getUTCDate().toString().padStart(2, "0"),
    (d.getUTCMonth() + 1).toString().padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("-");
}

async function extractImages(base64: string): Promise<EmbeddedImage[]> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const zip = await JSZip.loadAsync(raw, { base64: true });
    const drawingFiles = zip.file(/xl\/drawings\/drawing\d+\.xml$/);
    if (!drawingFiles.length) return [];

    const images: EmbeddedImage[] = [];

    for (const drawingFile of drawingFiles) {
      const xml = await drawingFile.async("string");
      const drawingName = drawingFile.name.split("/").pop()!;
      const relFile = zip.file(`xl/drawings/_rels/${drawingName}.rels`);
      if (!relFile) continue;

      const relXml = await relFile.async("string");
      const relMap: Record<string, string> = {};
      for (const m of relXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
        relMap[m[1]] = m[2];
      }

      const anchors = [...xml.matchAll(
        /<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g
      )];

      for (const anchor of anchors) {
        const c = anchor[1];
        const colM = c.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
        const rowM = c.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const rIdM = c.match(/r:embed="(rId\d+)"/);
        if (!colM || !rowM || !rIdM) continue;

        const target = relMap[rIdM[1]];
        if (!target) continue;
        const imgFile = zip.file(target.replace("../", "xl/"));
        if (!imgFile) continue;

        const imgB64 = await imgFile.async("base64");
        const ext = target.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        images.push({ b64: `data:${mime};base64,${imgB64}`, col: +colM[1], row: +rowM[1] });
      }
    }
    return images;
  } catch (e) {
    console.warn("No se pudieron extraer imágenes:", e);
    return [];
  }
}

function parseExcel(base64: string): CellData[][] {
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

      // Leer alineación desde metadatos de SheetJS (si están disponibles)
      // SheetJS community no expone estilos — derivamos de heurísticas del contenido
      const isBold = rowNum <= 5 || rowNum >= 24;
      const isCenter =
        (rowNum === 1 && colLetter === "C") ||
        (rowNum === 5 && ["A", "G"].includes(colLetter)) ||
        (rowNum >= 24 && ["A", "B", "C", "G"].includes(colLetter));

      rowArr.push({
        coord,
        col: colLetter,
        row: rowNum,
        value,
        rowspan: merge.rowspan,
        colspan: merge.colspan,
        isMappable: MAPPABLE_ROWS.has(rowNum),
        style: { align: isCenter ? "center" : "left", bold: isBold, wrapText: true },
      });
    }
    rows.push(rowArr);
  }
  return rows;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ExcelMapper({
  excelBase64,
  existingMappings,
  availablePlaceholders,
  onSave,
  onClose,
}: ExcelMapperProps) {
  const [rows, setRows] = useState<CellData[][]>([]);
  const [mappings, setMappings] = useState<Record<string, ExcelMapping>>({});
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderItem | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [embeddedImages, setEmbeddedImages] = useState<EmbeddedImage[]>([]);
  const [customLogo, setCustomLogo] = useState<string | null>(null); // base64 del logo nuevo
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setRows(parseExcel(excelBase64));
        const map: Record<string, ExcelMapping> = {};
        for (const m of existingMappings) map[m.coord] = m;
        setMappings(map);
        setEmbeddedImages(await extractImages(excelBase64));
      } catch (e) {
        setError("No se pudo leer el archivo Excel.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [excelBase64, existingMappings]);

  // Solo mostrar logo si el usuario subió uno, en la posición del logo original
  const logoForCell = (colLetter: string, rowNum: number): string | null => {
    if (!customLogo) return null;
    const c = XLSX.utils.decode_col(colLetter);
    const hasOriginal = embeddedImages.some((img) => img.col === c && img.row === rowNum - 1);
    return hasOriginal ? customLogo : null;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen (PNG, JPG, SVG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCustomLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCellClick = (cell: CellData) => {
    if (!cell.isMappable || !selectedPlaceholder) return;
    setMappings((prev) => ({
      ...prev,
      [cell.coord]: {
        coord: cell.coord,
        placeholder: selectedPlaceholder.placeholder,
        description: selectedPlaceholder.description,
      },
    }));
    const idx = availablePlaceholders.indexOf(selectedPlaceholder);
    if (idx < availablePlaceholders.length - 1)
      setSelectedPlaceholder(availablePlaceholders[idx + 1]);
  };

  const removeMapping = (coord: string) => {
    setMappings((prev) => { const c = { ...prev }; delete c[coord]; return c; });
  };

  const handleSave = () => {
    onSave(Object.values(mappings), customLogo ?? undefined);
  };

  const cellStyle = (cell: CellData): React.CSSProperties => {
    const mapped = !!mappings[cell.coord];
    const hovered = hoveredCell === cell.coord;
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
      cursor: cell.isMappable && selectedPlaceholder ? "crosshair" : mapped ? "pointer" : "default",
      verticalAlign: "middle",
      wordBreak: "break-word",
      lineHeight: 1.3,
      transition: "background 0.12s, border 0.12s",
    };
  };

  const mappingCount = Object.keys(mappings).length;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.75)",
      zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        width: "100%", maxWidth: 1320, maxHeight: "95vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #00c2a8, #0891b2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>📊</div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Mapear Campos en el Excel
              </h2>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                Selecciona un campo → haz clic en la celda donde debe aparecer el valor
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f1f5f9", border: "none", borderRadius: 8,
            width: 32, height: 32, fontSize: 16, color: "#64748b",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Panel izquierdo */}
          <div style={{
            width: 270, minWidth: 270,
            borderRight: "1px solid #f1f5f9",
            display: "flex", flexDirection: "column",
            background: "#fafafa",
          }}>

            {/* Logo section */}
            <div style={{
              padding: "12px 14px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fff",
            }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🖼️ Logo / Imagen
                </span>
              </div>

              {/* Input oculto */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: "none" }}
              />

              {/* Preview / placeholder */}
              {customLogo ? (
                /* — Logo cargado — */
                <div style={{
                  border: "1.5px solid #bbf7d0", borderRadius: 8,
                  padding: 8, background: "#f0fdf4",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 6,
                }}>
                  <img
                    src={customLogo}
                    alt="Logo"
                    style={{ maxHeight: 52, maxWidth: "100%", objectFit: "contain" }}
                  />
                  <div style={{ display: "flex", gap: 6, width: "100%" }}>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 600,
                        background: "#fff", color: "#0891b2",
                        border: "1px solid #bae6fd", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      🔄 Cambiar
                    </button>
                    <button
                      onClick={() => setCustomLogo(null)}
                      style={{
                        flex: 1, padding: "5px 0", fontSize: 10, fontWeight: 600,
                        background: "#fff", color: "#ef4444",
                        border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      🗑️ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                /* — Placeholder de carga — */
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{
                    width: "100%", padding: "14px 8px",
                    border: "2px dashed #cbd5e1", borderRadius: 8,
                    background: "#f8fafc", cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 4,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#00c2a8";
                    (e.currentTarget as HTMLButtonElement).style.background = "#f0fdf4";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1";
                    (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
                  }}
                >
                  <span style={{ fontSize: 22 }}>🖼️</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
                    Cargar imagen
                  </span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>
                    PNG, JPG, SVG
                  </span>
                </button>
              )}
            </div>

            {/* Campos del formulario */}
            <div style={{
              padding: "10px 14px 6px",
              fontSize: 11, fontWeight: 700, color: "#374151",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              📋 Campos del Formulario
            </div>

            {availablePlaceholders.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
                No hay campos en el formulario.<br />Agrega widgets primero.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
                {availablePlaceholders.map((p, i) => {
                  const isSel = selectedPlaceholder?.placeholder === p.placeholder;
                  const isMapped = Object.values(mappings).some((m) => m.placeholder === p.placeholder);
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedPlaceholder(isSel ? null : p)}
                      style={{
                        padding: "7px 10px", marginBottom: 3, borderRadius: 7,
                        border: isSel ? "2px solid #3b82f6" : isMapped ? "2px solid #22c55e" : "1.5px solid #f1f5f9",
                        background: isSel ? "#eff6ff" : isMapped ? "#f0fdf4" : "#fff",
                        cursor: "pointer", transition: "all 0.12s",
                        boxShadow: isSel ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
                      }}
                    >
                      <div style={{
                        fontSize: 10.5, fontFamily: "monospace",
                        color: isSel ? "#1d4ed8" : isMapped ? "#15803d" : "#374151",
                        fontWeight: 600, marginBottom: 1,
                      }}>
                        {isMapped ? "✅ " : isSel ? "👆 " : ""}{p.placeholder}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                        {p.description}
                        {p.widgetType && (
                          <span style={{
                            background: "#f1f5f9", padding: "0px 5px",
                            borderRadius: 4, fontSize: 9, color: "#64748b",
                          }}>
                            {p.widgetType}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instrucción activa */}
            <div style={{
              padding: "10px 12px",
              borderTop: "1px solid #f1f5f9",
              fontSize: 11, color: "#64748b",
              background: selectedPlaceholder ? "#eff6ff" : "#f8fafc",
              lineHeight: 1.5, transition: "background 0.2s",
            }}>
              {selectedPlaceholder ? (
                <>
                  <span style={{ color: "#1d4ed8", fontWeight: 700 }}>✋ Seleccionado:</span><br />
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#1e40af" }}>
                    {selectedPlaceholder.placeholder}
                  </span><br />
                  <span style={{ color: "#3b82f6" }}>→ Haz clic en una celda del Excel</span>
                </>
              ) : (
                <span>Selecciona un campo arriba para empezar a mapear.</span>
              )}
            </div>
          </div>

          {/* Panel derecho: tabla Excel */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "14px 16px", background: "#f8fafc" }}>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#64748b", gap: 8 }}>
                <span style={{ fontSize: 20 }}>⏳</span> Cargando Excel...
              </div>
            )}
            {error && (
              <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>
                ❌ {error}
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <>
                {/* Leyenda */}
                <div style={{
                  display: "flex", gap: 14, marginBottom: 10,
                  flexWrap: "wrap", fontSize: 10.5, color: "#64748b",
                  padding: "6px 10px", background: "#fff",
                  borderRadius: 8, border: "1px solid #f1f5f9",
                  width: "fit-content",
                }}>
                  {[
                    { bg: "#f0fdf8", bd: "#bbf7d0", label: "Encabezado" },
                    { bg: "#fff", bd: "#e2e8f0", label: "Celda disponible" },
                    { bg: "#eff6ff", bd: "#3b82f6", label: "Hover (al seleccionar)" },
                    { bg: "#f0fdf4", bd: "#22c55e", label: "Campo mapeado" },
                  ].map((l) => (
                    <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{
                        display: "inline-block", width: 11, height: 11,
                        background: l.bg, border: `2px solid ${l.bd}`,
                        borderRadius: 2, flexShrink: 0,
                      }} />
                      {l.label}
                    </span>
                  ))}
                </div>

                <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <table style={{ borderCollapse: "collapse", tableLayout: "fixed", fontSize: 10.5, minWidth: 960 }}>
                    <colgroup>
                      {["A","B","C","D","E","F","G","H","I"].map((col) => (
                        <col key={col} style={{ width: COL_WIDTHS[col] }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {["A","B","C","D","E","F","G","H","I"].map((col) => (
                          <th key={col} style={{
                            padding: "5px 6px",
                            background: "#f8fafc",
                            borderBottom: "2px solid #e2e8f0",
                            borderRight: "1px solid #f1f5f9",
                            fontSize: 10, fontWeight: 700,
                            color: "#94a3b8", textAlign: "center",
                            letterSpacing: "0.5px",
                          }}>
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
                            const logoSrc = logoForCell(cell.col, cell.row);

                            return (
                              <td
                                key={cell.coord}
                                colSpan={cell.colspan}
                                rowSpan={cell.rowspan}
                                style={cellStyle(cell)}
                                onClick={() => handleCellClick(cell)}
                                onMouseEnter={() => cell.isMappable && setHoveredCell(cell.coord)}
                                onMouseLeave={() => setHoveredCell(null)}
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
                                {/* Logo / imagen embebida */}
                                {logoSrc && (
                                  <div style={{ textAlign: "center", padding: "2px 0" }}>
                                    <img
                                      src={logoSrc}
                                      alt="logo"
                                      style={{
                                        maxWidth: "90%",
                                        maxHeight: 52,
                                        objectFit: "contain",
                                        display: "block",
                                        margin: "0 auto",
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Celda mapeada */}
                                {mapped ? (
                                  <div>
                                    <div style={{
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      fontSize: 9.5, fontFamily: "monospace",
                                      color: "#14532d", background: "#bbf7d0",
                                      padding: "1px 5px", borderRadius: 4,
                                      marginBottom: 2,
                                    }}>
                                      {mapped.placeholder}
                                    </div>
                                    {cell.value && (
                                      <div style={{ fontSize: 9, color: "#94a3b8", fontStyle: "italic" }}>
                                        {cell.value}
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeMapping(cell.coord); }}
                                      style={{
                                        marginTop: 2, fontSize: 9,
                                        background: "#fee2e2", color: "#dc2626",
                                        border: "1px solid #fca5a5",
                                        borderRadius: 4, padding: "1px 6px",
                                        cursor: "pointer", display: "block",
                                      }}
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

                {/* Nota sobre el PDF */}
                <div style={{
                  marginTop: 10, padding: "8px 12px",
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: 8, fontSize: 11, color: "#92400e",
                  display: "flex", alignItems: "flex-start", gap: 6,
                }}>
                  <span>💡</span>
                  <span>
                    Los colores de esta vista son solo para el mapeo. El PDF generado tendrá
                    <strong> fondo blanco</strong> con el formato original del Excel, sin ningún color de marcación.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "12px 24px",
          borderTop: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#f8fafc",
        }}>
          <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
            {mappingCount > 0 ? (
              <span style={{
                color: "#15803d", fontWeight: 600,
                background: "#f0fdf4", padding: "4px 10px",
                borderRadius: 20, border: "1px solid #bbf7d0",
                fontSize: 11,
              }}>
                ✅ {mappingCount} campo{mappingCount !== 1 ? "s" : ""} mapeado{mappingCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span style={{ color: "#94a3b8" }}>Ningún campo mapeado aún</span>
            )}
            {customLogo && (
              <span style={{
                color: "#0891b2", fontWeight: 600,
                background: "#f0f9ff", padding: "4px 10px",
                borderRadius: 20, border: "1px solid #bae6fd",
                fontSize: 11,
              }}>
                🖼️ Logo personalizado
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 20px", background: "#fff",
                color: "#64748b", border: "1.5px solid #e2e8f0",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "9px 22px",
                background: "linear-gradient(135deg, #00c2a8, #0891b2)",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0,194,168,0.35)",
              }}
            >
              💾 Guardar Mapeo ({mappingCount} campos)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}