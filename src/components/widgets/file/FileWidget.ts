import Preview from "./File.preview.tsx";
import Properties from "./File.properties.tsx";
import Render from "./File.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const FileWidget: WidgetDefinition = {
  type: "file",
  label: "Archivo",
  icon: "file",
  defaultConfig: {
    fileType: "documents",
    maxSizeMB: 25,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
