import Preview from "./Signature.preview.tsx";
import Properties from "./Signature.properties.tsx";
import Render from "./Signature.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const SignatureWidget: WidgetDefinition = {
  type: "signature",
  label: "Firma",
  icon: "signature",
  defaultConfig: {
    penColor: "#000000",
    penWidth: 2,
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
