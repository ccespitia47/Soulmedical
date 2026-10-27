import { useState, useRef } from "react";
import { useBuilderStore } from "../store/useBuilderStore";
import { useFolderStore } from "../store/useFolderStore";
import { widgetRegistry } from "../components/widgets/registry";
import QuizReviewModal from "../components/form/QuizReviewModal";
import Icon from "../components/common/Icon";
import { computeQuizReview } from "../lib/quizReview";
import { evaluateRules, extractRowsFromValues } from "../utils/formRules";

export default function PreviewPage({ onClose }: { onClose: () => void }) {
  const { widgets, currentFormId } = useBuilderStore();
  const { folders } = useFolderStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Las reglas viven en el form (schema.rules), no en un store aparte.
  const currentForm = currentFormId
    ? folders.flatMap((f) => f.forms).find((fm) => fm.id === currentFormId)
    : undefined;
  const rules = currentForm?.rules ?? [];
  const hiddenWidgetIds = evaluateRules(
    rules,
    fieldValues,
    extractRowsFromValues(fieldValues),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const missing: string[] = [];

    widgets.forEach((widget) => {
      if (widget.required && !hiddenWidgetIds.has(widget.id)) {
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
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <div style={{
      height: "100vh", overflowY: "auto",
      background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>

      {/* Topbar */}
      <header style={{
        background: "rgba(255,255,255,0.95)", borderBottom: "1px solid #e2e8f0",
        padding: "0 20px", height: 64, backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
            color: "#fff", boxShadow: "0 6px 16px -6px rgba(8,145,178,0.6)",
          }}>
            <Icon name="eye" size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: "#111827", margin: 0 }}>Vista Previa</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>Así se verá tu formulario</p>
          </div>
        </div>
        <button onClick={onClose} className="sf-pv-close" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 16px", background: "#fff", color: "#475569",
          border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <Icon name="x" size={15} strokeWidth={2.2} /> Cerrar vista previa
        </button>
      </header>

      {/* Contenedor */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div className="animate-fade-up" style={{
            background: "#ffffff", borderRadius: 18, overflow: "hidden",
            boxShadow: "0 14px 44px -14px rgba(15,45,90,0.22)",
            border: "1px solid rgba(15,23,42,0.05)",
          }}>
            <div style={{ height: 6, background: "linear-gradient(90deg, #00c2a8 0%, #0891b2 100%)" }} />
            <div style={{ padding: "24px" }}>
            <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 20, marginBottom: 28 }}>
              <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em", color: "#111827", margin: "0 0 8px" }}>
                Formulario de Captura
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Completa todos los campos para enviar el formulario. ¡Gracias por tu colaboración!
              </p>
            </div>

            {widgets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px", border: "2px dashed #e2e8f0", borderRadius: 14, color: "#9ca3af" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 64, height: 64, borderRadius: 18, marginBottom: 4,
                  background: "#e6f7f4", color: "#0891b2",
                }}>
                  <Icon name="clipboard" size={30} strokeWidth={1.8} />
                </span>
                <p style={{ fontSize: 15, marginTop: 16, fontWeight: 700, color: "#64748b" }}>No hay campos en el formulario</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Agrega widgets en el editor para verlos aquí</p>
              </div>
            ) : (
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                onChange={() => {
                  // Postergamos 1 frame para que React actualice hidden
                  // inputs derivados (calc, quiz_question __points) antes
                  // de leer — sin esto el quiz_score ve puntos viejos.
                  const form = formRef.current;
                  if (!form) return;
                  requestAnimationFrame(() => {
                    if (!form.isConnected) return;
                    const fd = new FormData(form);
                    const values: Record<string, string> = {};
                    fd.forEach((v, k) => {
                      values[k] = typeof v === "string" ? v : "";
                    });
                    setFieldValues(values);
                  });
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {widgets.map((widget) => {
                    const RenderComponent = widgetRegistry[widget.type]?.render;
                    const isHidden = hiddenWidgetIds.has(widget.id);
                    if (!RenderComponent) return null;

                    return (
                      // grid-template-rows 1fr/0fr colapsa sin tope de altura:
                      // el contenido largo (HTML, textos extensos) se ve completo.
                      <div key={widget.id} className="sf-pv-field" style={{
                        display: "grid",
                        gridTemplateRows: isHidden ? "0fr" : "1fr",
                        overflow: "hidden",
                        opacity: isHidden ? 0 : 1,
                        marginBottom: isHidden ? -20 : 0,
                        background: "#f9fafb",
                        borderRadius: 12,
                        border: isHidden ? "none" : "1px solid #e5e7eb",
                        transition: "grid-template-rows 0.25s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease, box-shadow 0.2s ease",
                        pointerEvents: isHidden ? "none" : "auto",
                      }}>
                        {/* minHeight 0 permite que el grid item colapse a 0 */}
                        <div style={{ minHeight: 0, overflow: "hidden", padding: isHidden ? "0 16px" : "16px" }}>
                          <RenderComponent
                            widget={widget}
                            fieldValues={fieldValues}
                            hiddenWidgetIds={hiddenWidgetIds}
                            allWidgets={widgets}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  marginTop: 32, paddingTop: 24, borderTop: "1px solid #e5e7eb",
                  display: "flex", gap: 12, justifyContent: "flex-end",
                }}>
                  <button type="button" onClick={onClose} className="sf-pv-cancel" style={{
                    padding: "11px 24px", background: "#fff", color: "#6b7280",
                    border: "1.5px solid #e2e8f0", borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>Cancelar</button>
                  <button type="submit" className="sf-pv-submit" style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 28px",
                    background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 8px 20px -8px rgba(8,145,178,0.65)",
                  }}>
                    <Icon name="send" size={16} strokeWidth={2} /> Enviar formulario
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>

          <div className="animate-fade-up" style={{
            marginTop: 20, padding: "15px 18px",
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 12, fontSize: 13, color: "#92400e", lineHeight: 1.6,
            display: "flex", alignItems: "flex-start", gap: 12,
            boxShadow: "0 6px 18px -12px rgba(146,64,14,0.5)",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, flexShrink: 0, borderRadius: 9,
              background: "#fef3c7", color: "#b45309",
            }}>
              <Icon name="eye" size={16} strokeWidth={2} />
            </span>
            <span>
              <strong>Modo Vista Previa:</strong> Estás viendo cómo se verá el formulario para los usuarios finales. Los datos ingresados aquí no se guardarán.
            </span>
          </div>
        </div>
      </div>

      {/* Modal campos faltantes */}
      {missingFields.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "40px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 24px", background: "linear-gradient(135deg, #ef4444, #dc2626)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Campos Obligatorios Faltantes</h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6 }}>Por favor completa los siguientes campos antes de enviar:</p>
            <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#991b1b", lineHeight: 1.8 }}>
                {missingFields.map((field, index) => <li key={index} style={{ fontWeight: 600 }}>{field}</li>)}
              </ul>
            </div>
            <button onClick={() => setMissingFields([])} style={{ padding: "12px 32px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal éxito — QuizReviewModal si el form tiene quiz configurado, si no el clásico */}
      {showSuccess && (() => {
        const review = computeQuizReview(widgets, fieldValues);
        if (review.hasReview) {
          return (
            <QuizReviewModal
              questions={review.questions}
              fieldValues={fieldValues}
              showCorrectness={review.showCorrectness}
              scoresToShow={review.scoresToShow}
              onClose={handleCloseSuccess}
            />
          );
        }
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
              <div style={{ width: 80, height: 80, margin: "0 auto 24px", background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(16,185,129,0.4)" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>¡Formulario Enviado con Éxito!</h2>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 28px", lineHeight: 1.6 }}>Tus datos han sido registrados correctamente. Gracias por completar el formulario.</p>
              <button onClick={handleCloseSuccess} style={{ padding: "12px 32px", background: "#10b981", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
                Entendido
              </button>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes checkDraw { to { stroke-dashoffset: 0; } }

        /* Realce del campo activo (interacción, no cambia la lógica) */
        .sf-pv-field:focus-within { box-shadow: inset 0 0 0 1.5px #00c2a8; }

        /* Botonera con elevación al hover (!important para vencer el estilo inline base) */
        .sf-pv-close, .sf-pv-cancel, .sf-pv-submit { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, color .2s ease; }
        .sf-pv-close:hover { transform: translateY(-1px); border-color: #cbd5e1 !important; color: #334155 !important; box-shadow: 0 6px 16px -8px rgba(15,23,42,0.35) !important; }
        .sf-pv-cancel:hover { transform: translateY(-1px); border-color: #cbd5e1 !important; color: #475569 !important; box-shadow: 0 6px 16px -8px rgba(15,23,42,0.35) !important; }
        .sf-pv-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px rgba(8,145,178,0.7) !important; }
        .sf-pv-submit:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}