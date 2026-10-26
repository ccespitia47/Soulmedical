import { useMemo } from "react";
import Icon from "../../common/Icon";
import type {
  WidgetInstance,
  WidgetRenderProps,
} from "../../../types/widget.types";

type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

/** Puntos "efectivos" de una opción según el modo de puntuación. */
function optionPoints(opt: QuizOption, scoreMode: string): number {
  if (scoreMode === "correct") return opt.correct ? 1 : 0;
  return opt.points ?? 0;
}

/**
 * Máximo posible para una pregunta. En modo single (radio) es la opción con
 * más puntos. En multi (checkbox) es la suma de todas las opciones con
 * puntos positivos (asumiendo que el user marca solo las correctas).
 */
function questionMax(question: WidgetInstance): number {
  const cfg = question.config;
  const options = (cfg.options as QuizOption[]) || [];
  const mode = (cfg.mode as string) || "single";
  const scoreMode = (cfg.scoreMode as string) || "correct";
  if (options.length === 0) return 0;

  const points = options.map((o) => optionPoints(o, scoreMode));
  if (mode === "single") {
    return Math.max(0, ...points);
  }
  return points.filter((p) => p > 0).reduce((a, b) => a + b, 0);
}

export default function QuizScoreRender({
  widget,
  fieldValues,
  allWidgets,
  hiddenWidgetIds,
}: WidgetRenderProps) {
  const cfg = widget.config;
  const includeQuestions = (cfg.includeQuestions as string) || "all";
  const includedIds = (cfg.includedIds as string[]) || [];
  const visibility = (cfg.visibility as string) || "visible";
  const showMax = (cfg.showMax as boolean) ?? true;
  const decimalPrecision = (cfg.decimalPrecision as number) ?? 1;

  const { earned, max } = useMemo(() => {
    const allQuestions = (allWidgets ?? []).filter(
      (w) => w.type === "quiz_question",
    );
    const selected =
      includeQuestions === "select"
        ? allQuestions.filter((q) => includedIds.includes(q.id))
        : allQuestions;

    let earnedSum = 0;
    let maxSum = 0;
    for (const q of selected) {
      // Ignoramos preguntas ocultas por reglas — no cuentan en el máximo ni
      // en lo obtenido. Coherente con el comportamiento de calc.
      if (hiddenWidgetIds?.has(q.id)) continue;

      const rawPoints = fieldValues?.[`${q.id}__points`] ?? "0";
      const parsed = parseFloat(rawPoints);
      earnedSum += Number.isFinite(parsed) ? parsed : 0;
      maxSum += questionMax(q);
    }
    return { earned: earnedSum, max: maxSum };
  }, [allWidgets, fieldValues, hiddenWidgetIds, includeQuestions, includedIds]);

  const fmt = (n: number) => n.toFixed(decimalPrecision);
  const display = showMax ? `${fmt(earned)} / ${fmt(max)}` : fmt(earned);

  // Siempre escribimos el hidden input — la nota llega a submissions/PDF
  // aunque el usuario no la vea en pantalla.
  const submitValue = String(earned);

  const hiddenToUser =
    visibility === "hidden_to_user" || visibility === "only_after_submit";

  return (
    <div>
      <input type="hidden" name={widget.id} value={submitValue} />
      <input
        type="hidden"
        name={`${widget.id}__max`}
        value={String(max)}
      />

      {hiddenToUser ? (
        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          {visibility === "only_after_submit"
            ? "La nota final se mostrará al finalizar la evaluación."
            : "Nota final calculada y registrada."}
        </p>
      ) : (
        <>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              color: "#111827",
            }}
          >
            {widget.label}
          </label>
          <div
            style={{
              padding: "12px 16px",
              border: "1.5px solid #0891b2",
              borderRadius: 8,
              background:
                "linear-gradient(135deg, rgba(0,194,168,0.06) 0%, rgba(8,145,178,0.09) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0891b2",
                fontFamily: "monospace",
                letterSpacing: "-0.02em",
              }}
            >
              {display}
            </span>
            <Icon name="award" size={20} />
          </div>
        </>
      )}
    </div>
  );
}
