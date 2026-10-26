import Preview from "./QuizScore.preview.tsx";
import Properties from "./QuizScore.properties.tsx";
import Render from "./QuizScore.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const QuizScoreWidget: WidgetDefinition = {
  type: "quiz_score",
  label: "Nota final",
  icon: "award",
  defaultConfig: {
    // "all" = todas las preguntas del formulario.
    // "select" = solo las de `includedIds` (para exámenes por secciones).
    includeQuestions: "all",
    includedIds: [] as string[],
    // "visible": el usuario ve la nota mientras llena.
    // "only_after_submit": se oculta durante llenado (comportamiento actual
    //   igual que `hidden_to_user` — declarativo para un futuro pantalla de
    //   resultado).
    // "hidden_to_user": nunca la ve el usuario, sí queda en submissions/PDF.
    visibility: "visible",
    showMax: true,
    decimalPrecision: 1,
    // Al enviar el formulario, abre un modal listando cada quiz_question
    // con la respuesta que marcó el usuario. Reemplaza al SuccessModal
    // normal — el botón "Finalizar revisión" cierra y equivale a "Volver".
    showAnswersReview: false,
    // Dentro del modal de revisión, pinta cada respuesta en verde/rojo según
    // si obtuvo el puntaje máximo posible de la pregunta. Solo aplica cuando
    // showAnswersReview está activo.
    showCorrectness: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
