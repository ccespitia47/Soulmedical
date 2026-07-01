import Preview from "./HtmlBlock.preview.tsx";
import Properties from "./HtmlBlock.properties.tsx";
import Render from "./HtmlBlock.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const HtmlBlockWidget: WidgetDefinition = {
  type: "html_block",
  label: "Bloque HTML",
  icon: "html",
  defaultConfig: {
    html: `<h4 style="text-align:right;"><strong><span style="color:#99cc00;">TÍTULO DEL FORMULARIO</span></strong></h4>
<p style="text-align:right;"><span style="color:#999999;">Dirección de la institución</span></p>`,
    height: "auto",
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};