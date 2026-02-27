import Preview from "./Header.preview.tsx";
import Properties from "./Header.properties.tsx";
import Render from "./Header.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const HeaderWidget: WidgetDefinition = {
  type: "header",
  label: "Encabezado",
  icon: "header",
  defaultConfig: {
    text: "Sección",
    size: "medium",
    showDivider: true,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
