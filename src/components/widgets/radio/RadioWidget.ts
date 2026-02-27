import Preview from "./Radio.preview.tsx";
import Properties from "./Radio.properties.tsx";
import Render from "./Radio.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const RadioWidget: WidgetDefinition = {
  type: "radio",
  label: "Opción única",
  icon: "radio",
  defaultConfig: {
    options: ["Opción 1", "Opción 2", "Opción 3"],
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
