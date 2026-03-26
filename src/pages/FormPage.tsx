import { useState, useRef } from "react";
import { widgetRegistry } from "../components/widgets/registry";
import { useSubmissionsStore } from "../store/useSubmissionsStore";
import type { WidgetInstance } from "../types/widget.types";

// ─── Props ────────────────────────────────────────────────────────────────────

type FormPageProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  onClose?: () => void;
  // Si viene de enlace público no tiene onClose
  isPublic?: boolean;
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FormPage({
  formId,
  folderId,
  formName,
  widgets,
  onClose,
  isPublic = false,
}: FormPageProps) {
  const { addSubmission } = useSubmissionsStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ─── Envío del formulario ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Validar campos obligatorios
    const missing: string[] = [];
    widgets.forEach((widget) => {
      if (widget.required) {
        const value = formData.get(widget.id);
        if (!value || (typeof value === "string" && !value.trim())) {
          missing.push(widget.label);
        }
      }
    });

    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setSubmitting(true);

    // Construir mapa widgetId → valor
    const data: Record<string, string> = {};
    widgets.forEach((widget) => {
      const value = formData.get(widget.id);
      data[widget.id] = value ? String(value) : "";
    });

    // Guardar en el store
    addSubmission({ formId, folderId, data });

    // Simular pequeño delay para UX
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    // Limpiar el formulario para poder diligenciar otro registro
    formRef.current?.reset();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f4f8",
      fontFamily: "'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Topbar (solo si no es público o tiene onClose) */}
      {!isPublic && (
        <header style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 20px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📋</span>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                {formName}
              </h1>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                Diligenciar formulario
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "7px 14px",
                background: "none",
                color: "#6b7280",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ← Volver
            </button>
          )}
        </header>
      )}

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Card formulario */}
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            padding: "28px 24px",
          }}>

            {/* Header */}
            <div style={{
              borderBottom: "2px solid #00c2a8",
              paddingBottom: 18,
              marginBottom: 24,
            }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>
                {formName}
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                Completa todos los campos marcados con <span style={{ color: "#ef4444" }}>*</span> y envía el formulario.
              </p>
            </div>

            {/* Sin widgets */}
            {widgets.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                border: "2px dashed #e2e8f0", borderRadius: 12, color: "#9ca3af",
              }}>
                <span style={{ fontSize: 48 }}>📋</span>
                <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600 }}>
                  Este formulario no tiene campos
                </p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {widgets.map((widget) => {
                    const RenderComponent = widgetRegistry[widget.type]?.render;
                    return RenderComponent ? (
                      <div key={widget.id} style={{
                        padding: 16,
                        background: "#f9fafb",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                      }}>
                        <RenderComponent widget={widget} />
                      </div>
                    ) : null;
                  })}
                </div>

                {/* Botones */}
                <div style={{
                  marginTop: 28,
                  paddingTop: 20,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                }}>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        padding: "10px 24px",
                        background: "none",
                        color: "#6b7280",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: "10px 28px",
                      background: submitting ? "#94a3b8" : "#00c2a8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      boxShadow: submitting ? "none" : "0 2px 8px rgba(0,194,168,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s",
                    }}
                  >
                    {submitting ? (
                      <>
                        <span style={{
                          width: 14, height: 14,
                          border: "2px solid rgba(255,255,255,0.4)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                          display: "inline-block",
                        }} />
                        Enviando...
                      </>
                    ) : (
                      "📤 Enviar formulario"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal campos faltantes ── */}
      {missingFields.length > 0 && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, padding: 20,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "40px",
            maxWidth: 480, width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "slideUp 0.3s ease",
          }}>
            <div style={{
              width: 72, height: 72, margin: "0 auto 20px",
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
            }}>
              <span style={{ fontSize: 36 }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>
              Campos obligatorios faltantes
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px", lineHeight: 1.6 }}>
              Por favor completa los siguientes campos:
            </p>
            <div style={{
              background: "#fef2f2", border: "1.5px solid #fecaca",
              borderRadius: 10, padding: "14px 18px", marginBottom: 20, textAlign: "left",
            }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#991b1b", lineHeight: 1.8 }}>
                {missingFields.map((f, i) => <li key={i} style={{ fontWeight: 600 }}>{f}</li>)}
              </ul>
            </div>
            <button
              onClick={() => setMissingFields([])}
              style={{
                padding: "11px 32px", background: "#ef4444", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", width: "100%",
                boxShadow: "0 4px 16px rgba(239,68,68,0.3)",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal éxito ── */}
      {showSuccess && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, padding: 20,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "48px 40px",
            maxWidth: 420, width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "slideUp 0.3s ease",
          }}>
            <div style={{
              width: 80, height: 80, margin: "0 auto 24px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>
              ¡Registro guardado!
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 28px", lineHeight: 1.6 }}>
              El formulario fue enviado correctamente. Puedes diligenciar otro registro.
            </p>
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                onClick={handleCloseSuccess}
                style={{
                  padding: "12px 32px", background: "#00c2a8", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 16px rgba(0,194,168,0.3)",
                }}
              >
                📋 Diligenciar otro registro
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  style={{
                    padding: "11px 32px", background: "none", color: "#6b7280",
                    border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Volver
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}