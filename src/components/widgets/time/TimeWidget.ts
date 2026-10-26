import Preview from "./Time.preview.tsx";
import Properties from "./Time.properties.tsx";
import Render from "./Time.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const TimeWidget: WidgetDefinition = {
  type: "time",
  label: "Hora",
  icon: "clock",
  defaultConfig: {
    // Al montar el widget, precarga con HH:MM actual del cliente.
    nowByDefault: false,
    // Persiste el último valor tipeado en localStorage por widget.id.
    rememberInput: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
