import type { WidgetInstance } from "../../types/widget.types";

type QuizOption = {
  id: string;
  label: string;
  points: number;
  correct: boolean;
};

/** Puntos efectivos de una opción según el modo de puntuación. */
function optionPoints(opt: QuizOption, scoreMode: string): number {
  if (scoreMode === "correct") return opt.correct ? 1 : 0;
  return opt.points ?? 0;
}

/** Máximo posible para una pregunta (mejor combinación de opciones). */
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

/** Etiquetas de las opciones "correctas" (todas las que dan puntos > 0). */
function correctLabels(question: WidgetInstance): string[] {
  const cfg = question.config;
  const options = (cfg.options as QuizOption[]) || [];
  const scoreMode = (cfg.scoreMode as string) || "correct";
  const mode = (cfg.mode as string) || "single";

  if (mode === "single") {
    // La opción con más puntos gana.
    let best: QuizOption | null = null;
    let bestPts = -Infinity;
    for (const o of options) {
      const p = optionPoints(o, scoreMode);
      if (p > bestPts) {
        bestPts = p;
        best = o;
      }
    }
    return best && bestPts > 0 ? [best.label] : [];
  }
  return options
    .filter((o) => optionPoints(o, scoreMode) > 0)
    .map((o) => o.label);
}

type ReviewScoreConfig = {
  widget: WidgetInstance;
  earned: number;
  max: number;
  decimalPrecision: number;
  showMax: boolean;
};

type QuizReviewModalProps = {
  questions: WidgetInstance[];
  fieldValues: Record<string, string>;
  showCorrectness: boolean;
  scoresToShow: ReviewScoreConfig[];
  onClose: () => void;
};

export default function QuizReviewModal({
  questions,
  fieldValues,
  showCorrectness,
  scoresToShow,
  onClose,
}: QuizReviewModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisión de respuestas"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="border-b border-slate-200 px-8 pb-5 pt-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 shadow-[0_8px_24px_rgba(8,145,178,0.35)]">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5" />
              <path d="M9 13h6M9 17h6" />
            </svg>
          </div>
          <h2 className="m-0 mb-1 text-[20px] font-bold text-slate-900">
            Revisión de tus respuestas
          </h2>
          <p className="m-0 text-[13px] text-slate-500">
            {questions.length}{" "}
            {questions.length === 1 ? "pregunta respondida" : "preguntas respondidas"}
          </p>
        </div>

        {/* Lista de preguntas — scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => {
              const answer = fieldValues[q.id] ?? "";
              const earned = parseFloat(fieldValues[`${q.id}__points`] ?? "0");
              const max = questionMax(q);
              const isCorrect = max > 0 && earned >= max;
              const correct = correctLabels(q);
              const missed =
                showCorrectness && !isCorrect && correct.length > 0
                  ? correct.filter((c) => !answer.includes(c))
                  : [];

              const borderColor = !showCorrectness
                ? "#e2e8f0"
                : isCorrect
                  ? "#22c55e"
                  : "#ef4444";
              const bgColor = !showCorrectness
                ? "#f8fafc"
                : isCorrect
                  ? "#f0fdf4"
                  : "#fef2f2";

              return (
                <div
                  key={q.id}
                  className="rounded-xl p-4"
                  style={{
                    border: `1.5px solid ${borderColor}`,
                    background: bgColor,
                  }}
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span className="text-[12px] font-bold text-slate-400">
                      {i + 1}.
                    </span>
                    <p className="m-0 flex-1 text-[13.5px] font-semibold text-slate-900">
                      {q.label || "(sin enunciado)"}
                    </p>
                    {showCorrectness && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                        style={{
                          background: isCorrect ? "#dcfce7" : "#fee2e2",
                          color: isCorrect ? "#166534" : "#991b1b",
                        }}
                      >
                        {isCorrect ? "Correcta" : "Incorrecta"}
                      </span>
                    )}
                  </div>
                  <p className="m-0 pl-5 text-[12.5px] text-slate-600">
                    <span className="font-medium">Tu respuesta: </span>
                    {answer.trim() ? (
                      answer
                    ) : (
                      <span className="italic text-slate-400">Sin respuesta</span>
                    )}
                  </p>
                  {missed.length > 0 && (
                    <p className="m-0 mt-1 pl-5 text-[12.5px] text-emerald-700">
                      <span className="font-medium">Correcta: </span>
                      {missed.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notas finales (una por cada quiz_score con "only_after_submit") */}
          {scoresToShow.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              {scoresToShow.map((s) => {
                const fmt = (n: number) => n.toFixed(s.decimalPrecision);
                const display = s.showMax
                  ? `${fmt(s.earned)} / ${fmt(s.max)}`
                  : fmt(s.earned);
                return (
                  <div
                    key={s.widget.id}
                    className="mb-2 flex items-center justify-between rounded-xl border-[1.5px] border-cyan-500 px-4 py-3"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,194,168,0.06) 0%, rgba(8,145,178,0.09) 100%)",
                    }}
                  >
                    <span className="text-[13px] font-semibold text-slate-900">
                      {s.widget.label || "Nota final"}
                    </span>
                    <span
                      className="text-[20px] font-extrabold text-cyan-700"
                      style={{ fontFamily: "monospace", letterSpacing: "-0.02em" }}
                    >
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-[10px] border-none bg-[#00c2a8] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(0,194,168,0.3)] transition-transform hover:-translate-y-0.5"
          >
            Finalizar revisión
          </button>
        </div>
      </div>
    </div>
  );
}
