import Preview from "./Photo.preview.tsx";
import Properties from "./Photo.properties.tsx";
import Render from "./Photo.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const PhotoWidget: WidgetDefinition = {
  type: "photo",
  label: "Foto",
  icon: "photo",
  defaultConfig: {
    allowCamera: true,
    allowUpload: true,
    maxSizeMB: 5,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
