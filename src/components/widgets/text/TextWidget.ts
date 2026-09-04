import Preview from "./Text.preview.tsx";
import Properties from "./Text.properties.tsx";
import Render from "./Text.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const TextWidget: WidgetDefinition = {
  type: "text",
  label: "Texto",
  icon: "text",
  defaultConfig: {
    placeholder: "",
    defaultValue: "",
    maxLength: 100,
    allowNumbers: false,
    allowSpecialChars: false,
    allowLineBreaks: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};