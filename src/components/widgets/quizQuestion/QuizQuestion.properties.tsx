import Icon from "../../common/Icon";
import type { WidgetPropertiesProps } from "../../../types/widget.types";

type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

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
const OPTION_ROW: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

function newId() {
  // ID legible y único por opción — no expuesto al usuario final.
  return `opt_${Math.random().toString(36).slice(2, 8)}`;
}

export default function QuizQuestionProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const options: QuizOption[] = (cfg.options as QuizOption[]) || [];
  const mode = (cfg.mode as string) || "single";
  const scoreMode = (cfg.scoreMode as string) || "correct";

  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  const updateOption = (i: number, changes: Partial<QuizOption>) =>
    set({
      options: options.map((o, idx) =>
        idx === i ? { ...o, ...changes } : o,
      ),
    });

  const addOption = () =>
    set({
      options: [
        ...options,
        {
          id: newId(),
          label: `Opción ${options.length + 1}`,
          points: 0,
          correct: false,
        },
      ],
    });

  const removeOption = (i: number) =>
    set({ options: options.filter((_, idx) => idx !== i) });

  return (
    <>
      {/* Etiqueta (enunciado) */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Enunciado</label>
        <input
          style={INPUT}
          value={widget.label}
          placeholder="¿Cuál es la respuesta correcta?"
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Tipo de respuesta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Tipo de respuesta</label>
        <select
          style={INPUT}
          value={mode}
          onChange={(e) => set({ mode: e.target.value })}
        >
          <option value="single">Una respuesta (radio)</option>
          <option value="multi">Varias respuestas (checkbox)</option>
        </select>
      </div>

      {/* Modo de puntuación */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Puntuación</label>
        <select
          style={INPUT}
          value={scoreMode}
          onChange={(e) => set({ scoreMode: e.target.value })}
        >
          <option value="correct">
            Marcar correctas (cada correcta vale 1 pt)
          </option>
          <option value="weighted">Peso libre por opción</option>
        </select>
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "6px 0 0",
            lineHeight: 1.4,
          }}
        >
          {scoreMode === "correct"
            ? "Solo debes marcar cuáles opciones son correctas."
            : "Cada opción puede tener puntos distintos, incluso negativos."}
        </p>
      </div>

      {/* Opciones */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <label style={{ ...LABEL, marginBottom: 0 }}>Opciones</label>
          <button
            type="button"
            onClick={addOption}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1.5px solid #0891b2",
              background: "white",
              color: "#0891b2",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name="plus" size={12} /> Opción
          </button>
        </div>

        {options.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              textAlign: "center",
              padding: "10px 0",
              margin: 0,
            }}
          >
            Agrega al menos una opción.
          </p>
        )}

        {options.map((opt, i) => (
          <div key={opt.id} style={OPTION_ROW}>
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                minWidth: 18,
                fontWeight: 600,
              }}
            >
              {i + 1}.
            </span>
            <input
              style={{ ...INPUT, flex: 1, padding: "6px 10px" }}
              value={opt.label}
              placeholder="Texto de la opción"
              onChange={(e) => updateOption(i, { label: e.target.value })}
            />
            {scoreMode === "weighted" ? (
              <input
                type="number"
                style={{ ...INPUT, width: 72, padding: "6px 8px" }}
                value={opt.points}
                onChange={(e) =>
                  updateOption(i, {
                    points: parseFloat(e.target.value) || 0,
                  })
                }
                title="Puntos"
              />
            ) : (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#0891b2",
                  cursor: "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  checked={opt.correct}
                  onChange={(e) =>
                    updateOption(i, {
                      correct: e.target.checked,
                      points: e.target.checked ? 1 : 0,
                    })
                  }
                />
                Correcta
              </label>
            )}
            <button
              type="button"
              onClick={() => removeOption(i)}
              aria-label="Quitar opción"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "none",
                background: "#fee2e2",
                color: "#ef4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
