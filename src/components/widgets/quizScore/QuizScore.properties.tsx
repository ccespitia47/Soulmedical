import type { WidgetPropertiesProps } from "../../../types/widget.types";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#f8fafc",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};
const QUESTION_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 12.5,
  color: "#111827",
  cursor: "pointer",
};

export default function QuizScoreProperties({
  widget,
  updateWidget,
  allWidgets,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const includeQuestions = (cfg.includeQuestions as string) || "all";
  const includedIds = (cfg.includedIds as string[]) || [];
  const visibility = (cfg.visibility as string) || "visible";
  const showMax = (cfg.showMax as boolean) ?? true;
  const decimalPrecision = (cfg.decimalPrecision as number) ?? 1;
  const showAnswersReview = (cfg.showAnswersReview as boolean) ?? false;
  const showCorrectness = (cfg.showCorrectness as boolean) ?? false;

  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  const availableQuestions = (allWidgets ?? []).filter(
    (w) => w.type === "quiz_question" && w.id !== widget.id,
  );

  const toggleQuestion = (id: string) => {
    const next = includedIds.includes(id)
      ? includedIds.filter((x) => x !== id)
      : [...includedIds, id];
    set({ includedIds: next });
  };

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          placeholder="Nota final"
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Preguntas a incluir */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Preguntas a incluir</label>
        <select
          style={INPUT}
          value={includeQuestions}
          onChange={(e) => set({ includeQuestions: e.target.value })}
        >
          <option value="all">Todas las preguntas del formulario</option>
          <option value="select">Solo las que yo elija</option>
        </select>

        {includeQuestions === "select" && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            {availableQuestions.length === 0 ? (
              <p
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  margin: 0,
                  textAlign: "center",
                  padding: "6px 0",
                }}
              >
                Aún no hay preguntas de evaluación en el formulario.
              </p>
            ) : (
              availableQuestions.map((q) => (
                <label key={q.id} style={QUESTION_ROW}>
                  <input
                    type="checkbox"
                    checked={includedIds.includes(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                    style={{ accentColor: "#0891b2" }}
                  />
                  <span style={{ flex: 1 }}>
                    {q.label || `(sin etiqueta) — ${q.id}`}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Visibilidad */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Visibilidad para el usuario</label>
        <select
          style={INPUT}
          value={visibility}
          onChange={(e) => set({ visibility: e.target.value })}
        >
          <option value="visible">Visible mientras llena</option>
          <option value="only_after_submit">Solo al finalizar</option>
          <option value="hidden_to_user">Oculta para el usuario</option>
        </select>
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "6px 0 0",
            lineHeight: 1.4,
          }}
        >
          En todos los casos la nota queda guardada en submissions, reports y
          PDF.
        </p>
      </div>

      {/* Precisión decimal */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Precisión decimal</label>
        <input
          type="number"
          style={INPUT}
          min={0}
          max={5}
          value={decimalPrecision}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            set({ decimalPrecision: Number.isFinite(n) ? n : 0 });
          }}
        />
      </div>

      {/* Mostrar máximo */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <input
          type="checkbox"
          checked={showMax}
          onChange={(e) => set({ showMax: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Mostrar puntaje sobre máximo (ej. 7.5 / 10)</span>
      </label>

      {/* Modal de revisión al finalizar */}
      <div
        style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "#111827",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={showAnswersReview}
            onChange={(e) => set({ showAnswersReview: e.target.checked })}
            style={{ accentColor: "#0891b2" }}
          />
          <span>Al enviar, mostrar modal de revisión</span>
        </label>
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "6px 0 10px 24px",
            lineHeight: 1.4,
          }}
        >
          Lista cada pregunta con la respuesta que marcó el usuario y
          reemplaza al mensaje normal de envío exitoso.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: showAnswersReview ? "#111827" : "#94a3b8",
            cursor: showAnswersReview ? "pointer" : "not-allowed",
            marginLeft: 24,
          }}
        >
          <input
            type="checkbox"
            checked={showCorrectness}
            disabled={!showAnswersReview}
            onChange={(e) => set({ showCorrectness: e.target.checked })}
            style={{ accentColor: "#0891b2" }}
          />
          <span>Marcar respuestas correctas/incorrectas</span>
        </label>
        {showAnswersReview && (
          <p
            style={{
              fontSize: 11,
              color: "#9ca3af",
              margin: "6px 0 0 48px",
              lineHeight: 1.4,
            }}
          >
            Pinta cada respuesta verde o roja y muestra la correcta cuando el
            usuario falló.
          </p>
        )}
      </div>
    </>
  );
}
