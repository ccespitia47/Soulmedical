import { useState } from "react";
import { useBuilderStore } from "../store/useBuilderStore";
import { widgetRegistry } from "../components/widgets/registry";

export default function PreviewPage({ onClose }: { onClose: () => void }) {
  const { widgets } = useBuilderStore();
  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar campos obligatorios
    const missingFields: string[] = [];
    const formData = new FormData(e.target as HTMLFormElement);
    
    widgets.forEach((widget) => {
      if (widget.required) {
        const value = formData.get(widget.id);
        if (!value || (typeof value === 'string' && !value.trim())) {
          missingFields.push(widget.label);
        }
      }
    });

    if (missingFields.length > 0) {
      setMissingFields(missingFields);
      return;
    }

    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <div style={{ 
      height: "100vh", 
      overflowY: "auto",
      background: "#f0f4f8", 
      fontFamily: "'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      
      {/* Topbar */}
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
          <span style={{ fontSize: 24 }}>👁️</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
              Vista Previa
            </h1>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
              Así se verá tu formulario
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            background: "#6b7280",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ✕ Cerrar vista previa
        </button>
      </header>

      {/* Contenedor del formulario */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px 16px",
      }}>
        <div style={{
          maxWidth: 680,
          margin: "0 auto",
        }}>
        
        {/* Card del formulario */}
        <div style={{
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          padding: "20px",
        }}>
          
          {/* Header del formulario */}
          <div style={{
            borderBottom: "2px solid #00c2a8",
            paddingBottom: 20,
            marginBottom: 28,
          }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 8px",
            }}>
              Formulario de Captura
            </h2>
            <p style={{
              fontSize: 14,
              color: "#6b7280",
              margin: 0,
            }}>
              Completa todos los campos para enviar el formulario. ¡Gracias por tu colaboración!
            </p>
          </div>

          {/* Formulario */}
          {widgets.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "60px 20px",
              border: "2px dashed #e2e8f0",
              borderRadius: 12,
              color: "#9ca3af",
            }}>
              <span style={{ fontSize: 48 }}>📋</span>
              <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600 }}>
                No hay campos en el formulario
              </p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                Agrega widgets en el editor para verlos aquí
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}>
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

              {/* Botón de envío */}
              <div style={{
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}>
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
                <button
                  type="submit"
                  style={{
                    padding: "10px 28px",
                    background: "#00c2a8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 2px 8px rgba(0,194,168,0.3)",
                  }}
                >
                  📤 Enviar formulario
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Info adicional */}
        <div style={{
          marginTop: 20,
          padding: "16px 20px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          fontSize: 13,
          color: "#92400e",
          lineHeight: 1.6,
        }}>
          <strong>💡 Modo Vista Previa:</strong> Estás viendo cómo se verá el formulario para los usuarios finales. Los datos ingresados aquí no se guardarán.
        </div>
        </div>
      </div>


      {/* ── Modal de Error (Campos faltantes) ── */}
      {missingFields.length > 0 && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 300,
          padding: 20,
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "40px",
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>
            
            {/* Ícono X animado */}
            <div style={{
              width: 80,
              height: 80,
              margin: "0 auto 24px",
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
              animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: "xDraw 0.6s ease 0.3s forwards", strokeDasharray: 50, strokeDashoffset: 50 }}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            {/* Texto */}
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 12px",
            }}>
              Campos Obligatorios Faltantes
            </h2>
            
            <p style={{
              fontSize: 14,
              color: "#6b7280",
              margin: "0 0 20px",
              lineHeight: 1.6,
            }}>
              Por favor completa los siguientes campos antes de enviar:
            </p>

            {/* Lista de campos faltantes */}
            <div style={{
              background: "#fef2f2",
              border: "1.5px solid #fecaca",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 24,
              textAlign: "left",
            }}>
              <ul style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 14,
                color: "#991b1b",
                lineHeight: 1.8,
              }}>
                {missingFields.map((field, index) => (
                  <li key={index} style={{ fontWeight: 600 }}>
                    {field}
                  </li>
                ))}
              </ul>
            </div>

            {/* Botón */}
            <button
              onClick={() => setMissingFields([])}
              style={{
                padding: "12px 32px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(239,68,68,0.3)",
                width: "100%",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de Éxito ── */}
      {showSuccess && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 300,
          padding: 20,
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "48px 40px",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>
            
            {/* Ícono animado */}
            <div style={{
              width: 80,
              height: 80,
              margin: "0 auto 24px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
              animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: "checkDraw 0.6s ease 0.3s forwards", strokeDasharray: 50, strokeDashoffset: 50 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Texto */}
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 12px",
            }}>
              ¡Formulario Enviado con Éxito!
            </h2>
            
            <p style={{
              fontSize: 14,
              color: "#6b7280",
              margin: "0 0 28px",
              lineHeight: 1.6,
            }}>
              Tus datos han sido registrados correctamente. Gracias por completar el formulario.
            </p>

            {/* Botón */}
            <button
              onClick={handleCloseSuccess}
              style={{
                padding: "12px 32px",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                width: "100%",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Animaciones CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes xDraw {
          to { stroke-dashoffset: 0; }
        }
          @media (min-width: 640px) {
          .preview-card { padding: 32px !important; }
        }
      `}</style>
    </div>
  );
}