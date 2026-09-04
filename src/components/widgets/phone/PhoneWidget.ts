import Preview from "./Phone.preview.tsx";
import Properties from "./Phone.properties.tsx";
import Render from "./Phone.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const PhoneWidget: WidgetDefinition = {
  type: "phone",
  label: "Teléfono",
  icon: "phone",
  defaultConfig: {
    placeholder: "300 123 4567",
    prefix: "+57",
    maxLength: 10,
    enableCountrySelector: false,
    defaultCountry: "CO",
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
