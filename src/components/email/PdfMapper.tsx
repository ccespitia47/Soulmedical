import { useState, useRef } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFieldMapping } from "../../types/email-template.types";

// Configurar worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

type PdfMapperProps = {
  pdfBase64: string;
  existingMappings: PdfFieldMapping[];
  availablePlaceholders: Array<{ placeholder: string; description: string }>;
  onSave: (mappings: PdfFieldMapping[]) => void;
  onClose: () => void;
};

export default function PdfMapper({
  pdfBase64,
  existingMappings,
  availablePlaceholders,
  onSave,
  onClose,
}: PdfMapperProps) {
  const [mappings, setMappings] = useState<PdfFieldMapping[]>(existingMappings);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<string>("");
  const [scale, setScale] = useState(1.5);
  const pageRef = useRef<HTMLDivElement>(null);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlaceholder || !pageRef.current) {
      if (!selectedPlaceholder) {
        alert("Selecciona un campo de la lista primero");
      }
      return;
    }

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const placeholderInfo = availablePlaceholders.find(
      p => p.placeholder === selectedPlaceholder
    );

    const newMapping: PdfFieldMapping = {
      placeholder: selectedPlaceholder,
      x,
      y,
      page: currentPage - 1,
      fontSize: 10,
      fieldLabel: placeholderInfo?.description || selectedPlaceholder,
    };

    const filtered = mappings.filter(
      m => !(m.placeholder === selectedPlaceholder && m.page === currentPage - 1)
    );

    setMappings([...filtered, newMapping]);
    setSelectedPlaceholder("");
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(mappings);
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.8)",
      zIndex: 400,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        width: "100%",
        maxWidth: 1400,
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
              📍 Mapear Campos en el PDF
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Haz clic en el PDF donde quieres que aparezca cada campo del formulario
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "#9ca3af", cursor: "pointer", padding: 4 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          
          {/* Panel izquierdo */}
          <div style={{ width: 300, borderRight: "1px solid #e2e8f0", padding: 20, overflowY: "auto" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
              📋 Campos del Formulario
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
              Selecciona un campo y haz clic en el PDF
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availablePlaceholders.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPlaceholder(p.placeholder)}
                  style={{
                    padding: "10px 12px",
                    background: selectedPlaceholder === p.placeholder ? "#e6faf7" : "#f9fafb",
                    border: `2px solid ${selectedPlaceholder === p.placeholder ? "#00c2a8" : "#e2e8f0"}`,
                    borderRadius: 8,
                    fontSize: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#111827" }}>{p.description}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{p.placeholder}</div>
                </button>
              ))}
            </div>

            {mappings.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 24, marginBottom: 12 }}>
                  ✓ Campos Mapeados ({mappings.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {mappings.map((m, i) => (
                    <div key={i} style={{ padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#166534" }}>{m.fieldLabel}</div>
                        <div style={{ color: "#6b7280", fontSize: 10 }}>Página {m.page + 1}</div>
                      </div>
                      <button onClick={() => handleRemoveMapping(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, padding: 4 }} title="Eliminar">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb" }}>
            
            {/* Controles */}
            <div style={{ padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: "6px 12px", background: currentPage === 1 ? "#f9fafb" : "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 12 }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: "6px 12px", background: currentPage === totalPages ? "#f9fafb" : "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 12 }}>
                  Siguiente →
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Zoom:</span>
                <button onClick={() => setScale(Math.max(0.5, scale - 0.25))} style={{ padding: "4px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>−</button>
                <span style={{ fontSize: 12, minWidth: 45, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(Math.min(3, scale + 0.25))} style={{ padding: "4px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>+</button>
              </div>
            </div>

            {/* PDF Preview */}
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
              <div ref={pageRef} onClick={handlePageClick} style={{ position: "relative", cursor: selectedPlaceholder ? "crosshair" : "default" }}>
                <Document
                  file={pdfBase64}
                  onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
                  onLoadError={(error) => {
                    console.error("Error cargando PDF:", error);
                    alert("Error al cargar el PDF");
                  }}
                >
                  <Page pageNumber={currentPage} scale={scale} />
                </Document>
                
                {/* Marcadores de mappings */}
                {mappings.filter(m => m.page === currentPage - 1).map((m, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: m.x * scale,
                      top: m.y * scale,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "rgba(0, 194, 168, 0.7)",
                      border: "2px solid #00c2a8",
                    }} />
                    <div style={{
                      position: "absolute",
                      left: 20,
                      top: -4,
                      background: "#00c2a8",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      {m.fieldLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ padding: "10px 24px", background: "#00c2a8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,194,168,0.3)" }}>
            💾 Guardar Mapeo ({mappings.length} campos)
          </button>
        </div>
      </div>
    </div>
  );
}