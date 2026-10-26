import Preview from "./Image.preview.tsx";
import Properties from "./Image.properties.tsx";
import Render from "./Image.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const ImageWidget: WidgetDefinition = {
  type: "image",
  label: "Imagen",
  icon: "image",
  defaultConfig: {
    src: "",
    mediaId: "",
    maxWidth: 180,
    maxHeight: null,
    clickable: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
