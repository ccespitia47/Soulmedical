import Preview from "./PendingActivity.preview";
import Properties from "./PendingActivity.properties";
import Render from "./PendingActivity.render";
import type { WidgetDefinition } from "../../../types/widget.types";

/**
 * Widget "Cumplimiento actividades": muestra al usuario las filas de
 * subformulario de un formulario de Planeación propio que todavía no
 * cumplió. Al enviar el formulario (Cumplimiento), el valor seleccionado
 * se guarda en `completesActivities` y el backend bloquea que la misma
 * actividad se cumpla dos veces.
 *
 * Icon `checkCircle`: existente en Icon.tsx. Semánticamente apropiado
 * (actividad a completar → check).
 */
export const PendingActivityWidget: WidgetDefinition = {
  type: "pending_activity",
  label: "Cumplimiento actividades",
  icon: "checkCircle",
  defaultConfig: {
    planningFormId: "",
    subformWidgetId: "",
    displayFields: [],
    allowMultiple: true,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
