import Preview from "./Price.preview.tsx";
import Properties from "./Price.properties.tsx";
import Render from "./Price.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const PriceWidget: WidgetDefinition = {
  type: "price",
  label: "Precio",
  icon: "price",
  defaultConfig: {
    currency: "COP",
    decimalMark: "comma",
    decimalPrecision: 2,
    minAmount: "",
    maxAmount: "",
    rememberInput: false,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
