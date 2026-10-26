import Preview from "./QuizQuestion.preview.tsx";
import Properties from "./QuizQuestion.properties.tsx";
import Render from "./QuizQuestion.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const QuizQuestionWidget: WidgetDefinition = {
  type: "quiz_question",
  label: "Pregunta de evaluación",
  icon: "help",
  defaultConfig: {
    // "single" = una respuesta (radio). "multi" = varias (checkbox).
    mode: "single",
    // "correct" = cada opción marcada correcta vale 1 pto.
    // "weighted" = el admin define los puntos por opción libremente.
    scoreMode: "correct",
    // { id, label, points, correct }
    options: [
      { id: "opt_1", label: "Opción 1", points: 1, correct: true },
      { id: "opt_2", label: "Opción 2", points: 0, correct: false },
    ],
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
