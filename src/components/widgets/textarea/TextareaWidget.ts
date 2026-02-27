import Preview from "./Textarea.preview.tsx";
import Properties from "./Textarea.properties.tsx";
import Render from "./Textarea.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const TextareaWidget: WidgetDefinition = {
  type: "textarea",
  label: "Párrafo",
  icon: "textarea",
  defaultConfig: {
    placeholder: "",
    maxLength: 500,
    rows: 4,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
