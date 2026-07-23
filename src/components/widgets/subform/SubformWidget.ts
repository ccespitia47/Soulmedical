import type { WidgetDefinition } from "../../../types/widget.types";
import SubformPreview from "./Subform.preview";
import SubformProperties from "./Subform.properties";
import SubformRender from "./Subform.render";

export const SubformWidget: WidgetDefinition = {
  type: "subform",
  label: "Subformulario",
  icon: "🗂️",
  defaultConfig: {
    addButtonLabel: "Agregar",
    fields: [], // SubformField[]
    minEntries: 0,
    maxEntries: 0, // 0 = sin límite
  },
  preview: SubformPreview,
  properties: SubformProperties,
  render: SubformRender,
};