import Preview from "./Select.preview.tsx";
import Properties from "./Select.properties.tsx";
import Render from "./Select.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const SelectWidget: WidgetDefinition = {
  type: "select",
  label: "Desplegable",
  icon: "select",
  defaultConfig: {
    placeholder: "Selecciona una opción",
    options: ["Opción 1", "Opción 2", "Opción 3"],
    defaultValue: "",
    sortAlphabetically: false,
    multiple: false,
    expand: false,
    rememberEntry: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
