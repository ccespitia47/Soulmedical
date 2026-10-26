import Preview from "./Calc.preview.tsx";
import Properties from "./Calc.properties.tsx";
import Render from "./Calc.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const CalcWidget: WidgetDefinition = {
  type: "calc",
  label: "Cálculo",
  icon: "calc",
  defaultConfig: {
    operator: "sum",
    terms: [],
    initialValue: "",
    decimalPrecision: 2,
    ignoreInvalid: true,
    ignoreHidden: false,
    isPrice: false,
    currency: "COP",
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
