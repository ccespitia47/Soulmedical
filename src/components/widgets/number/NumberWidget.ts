import Preview from "./Number.preview.tsx";
import Properties from "./Number.properties.tsx";
import Render from "./Number.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const NumberWidget: WidgetDefinition = {
  type: "number",
  label: "Número",
  icon: "number",
  defaultConfig: {
    placeholder: "",
    min: 0,
    max: 999999,
    step: 1,
    allowDecimals: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
