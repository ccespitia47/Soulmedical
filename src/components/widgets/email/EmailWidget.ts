import Preview from "./Email.preview.tsx";
import Properties from "./Email.properties.tsx";
import Render from "./Email.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const EmailWidget: WidgetDefinition = {
  type: "email",
  label: "Email",
  icon: "email",
  defaultConfig: {
    placeholder: "correo@ejemplo.com",
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
