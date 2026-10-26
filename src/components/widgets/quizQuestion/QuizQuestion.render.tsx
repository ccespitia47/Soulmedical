import { useMemo, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";

type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

/**
 * Puntos "efectivos" de una opción según el modo de puntuación configurado.
 * - `correct`: cada correcta vale 1, el resto 0 (ignoramos `points`).
 * - `weighted`: usa el `points` que puso el admin, incluso negativos.
 */
function optionPoints(opt: QuizOption, scoreMode: string): number {
  if (scoreMode === "correct") return opt.correct ? 1 : 0;
  return opt.points ?? 0;
}

export default function QuizQuestionRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const options: QuizOption[] = (cfg.options as QuizOption[]) || [];
  const mode = (cfg.mode as string) || "single";
  const scoreMode = (cfg.scoreMode as string) || "correct";

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (mode === "single") {
      setSelected([id]);
      return;
    }
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Puntos obtenidos = suma directa de los puntos efectivos de cada opción
  // seleccionada. Se ignoran las incorrectas (no penaliza) — decisión de
  // diseño confirmada con el usuario.
  const earnedPoints = useMemo(() => {
    return options
      .filter((o) => selected.includes(o.id))
      .reduce((acc, o) => acc + optionPoints(o, scoreMode), 0);
  }, [options, selected, scoreMode]);

  // Texto legible que va al submit y al Excel/PDF/reports.
  const answerText = options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.label)
    .join(", ");

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: "#111827",
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>

      {/* Dos hidden inputs — respuesta legible + puntos numéricos. Ambos
          se recolectan en el submit por FormData y quedan en fieldValues
          para que el widget `quiz_score` los sume. */}
      <input type="hidden" name={widget.id} value={answerText} />
      <input
        type="hidden"
        name={`${widget.id}__points`}
        value={String(earnedPoints)}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.length === 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Sin opciones configuradas.
          </p>
        )}
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <label
              key={opt.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                border: isSelected
                  ? "1.5px solid #0891b2"
                  : "1.5px solid #e2e8f0",
                borderRadius: 8,
                background: isSelected ? "#ecfeff" : "#f8fafc",
                cursor: "pointer",
                fontSize: 13,
                color: "#111827",
                transition: "all 0.15s ease-out",
              }}
            >
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                name={`${widget.id}__input`}
                checked={isSelected}
                onChange={() => toggle(opt.id)}
                style={{ accentColor: "#0891b2" }}
              />
              <span style={{ flex: 1 }}>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
