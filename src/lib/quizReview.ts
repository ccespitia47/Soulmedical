import type { WidgetInstance } from "../types/widget.types";

type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

export type ReviewScoreConfig = {
  widget: WidgetInstance;
  earned: number;
  max: number;
  decimalPrecision: number;
  showMax: boolean;
};

export type QuizReview = {
  hasReview: boolean;
  questions: WidgetInstance[];
  scoresToShow: ReviewScoreConfig[];
  showCorrectness: boolean;
};

function optionPoints(opt: QuizOption, scoreMode: string): number {
  if (scoreMode === "correct") return opt.correct ? 1 : 0;
  return opt.points ?? 0;
}

function questionMax(question: WidgetInstance): number {
  const cfg = question.config;
  const options = (cfg.options as QuizOption[]) || [];
  const mode = (cfg.mode as string) || "single";
  const scoreMode = (cfg.scoreMode as string) || "correct";
  if (options.length === 0) return 0;
  const points = options.map((o) => optionPoints(o, scoreMode));
  if (mode === "single") return Math.max(0, ...points);
  return points.filter((p) => p > 0).reduce((a, b) => a + b, 0);
}

/**
 * Decide si el flujo post-submit debe abrir el `QuizReviewModal` en lugar
 * del feedback normal. Se activa cuando el formulario tiene al menos un
 * `quiz_score` con `showAnswersReview` marcado.
 *
 * Devuelve además los datos que consume el modal: las preguntas a listar,
 * las notas a mostrar (solo las de visibility `only_after_submit`) y si
 * debe pintar respuestas correctas/incorrectas.
 */
export function computeQuizReview(
  widgets: WidgetInstance[],
  fieldValues: Record<string, string>,
): QuizReview {
  const scores = widgets.filter((w) => w.type === "quiz_score");
  const enabling = scores.filter(
    (s) => (s.config.showAnswersReview as boolean) === true,
  );
  if (enabling.length === 0) {
    return { hasReview: false, questions: [], scoresToShow: [], showCorrectness: false };
  }

  const questions = widgets.filter((w) => w.type === "quiz_question");

  // "Solo al finalizar" es la única visibility que expone la nota en el
  // modal. "visible" ya se ve durante el llenado. "hidden_to_user" nunca la
  // muestra al usuario final.
  const scoresToShow: ReviewScoreConfig[] = scores
    .filter((s) => (s.config.visibility as string) === "only_after_submit")
    .map((s) => {
      const includeQuestions = (s.config.includeQuestions as string) || "all";
      const includedIds = (s.config.includedIds as string[]) || [];
      const decimalPrecision = (s.config.decimalPrecision as number) ?? 1;
      const showMax = (s.config.showMax as boolean) ?? true;

      const selected =
        includeQuestions === "select"
          ? questions.filter((q) => includedIds.includes(q.id))
          : questions;

      let earned = 0;
      let max = 0;
      for (const q of selected) {
        const raw = fieldValues[`${q.id}__points`] ?? "0";
        const parsed = parseFloat(raw);
        earned += Number.isFinite(parsed) ? parsed : 0;
        max += questionMax(q);
      }
      return { widget: s, earned, max, decimalPrecision, showMax };
    });

  // Basta que UNO de los quiz_score que activan el modal tenga
  // `showCorrectness` para pintar correcto/incorrecto en todas las preguntas.
  const showCorrectness = enabling.some(
    (s) => (s.config.showCorrectness as boolean) === true,
  );

  return { hasReview: true, questions, scoresToShow, showCorrectness };
}
