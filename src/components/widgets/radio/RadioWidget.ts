import Preview from "./Radio.preview.tsx";
import Properties from "./Radio.properties.tsx";
import Render from "./Radio.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const RadioWidget: WidgetDefinition = {
  type: "radio",
  label: "Radio",
  icon: "radio",
  defaultConfig: {
    // Opciones legacy pueden venir como `string[]`; los helpers
    // `normalizeRadioOptions` en render/properties/preview reconvierten
    // al shape actual `{ id, label, imageId?, imageUrl? }` on-the-fly.
    options: [
      { id: "opt_1", label: "Opción 1" },
      { id: "opt_2", label: "Opción 2" },
    ],
    useImageLabels: false,
    defaultValue: "",
    verticalAlign: true,
    rememberInput: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
