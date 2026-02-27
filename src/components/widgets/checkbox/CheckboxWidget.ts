import Preview from "./Checkbox.preview.tsx";
import Properties from "./Checkbox.properties.tsx";
import Render from "./Checkbox.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const CheckboxWidget: WidgetDefinition = {
  type: "checkbox",
  label: "Casillas",
  icon: "checkbox",
  defaultConfig: {
    options: ["Opción 1", "Opción 2", "Opción 3"],
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
