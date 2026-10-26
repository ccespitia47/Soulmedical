import Preview from "./Video.preview.tsx";
import Properties from "./Video.properties.tsx";
import Render from "./Video.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const VideoWidget: WidgetDefinition = {
  type: "video",
  label: "Video",
  icon: "video",
  defaultConfig: {
    maxDurationSecs: 60,
    // Cap del propio widget en MB — el backend impone además su tope de 200.
    maxSizeMB: 100,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
