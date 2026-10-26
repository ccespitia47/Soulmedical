import Preview from "./IdDocument.preview.tsx";
import Properties from "./IdDocument.properties.tsx";
import Render from "./IdDocument.render.tsx";
import type { WidgetDefinition } from "../../../types/widget.types";

export const IdDocumentWidget: WidgetDefinition = {
  type: "id_document",
  label: "Documento de identidad",
  icon: "idCard",
  defaultConfig: {
    // Códigos ISO 3166 alpha-2 de los países habilitados en este formulario.
    // Vacío no tiene sentido — el default arranca solo con Colombia.
    countries: ["CO"],
    // País pre-seleccionado en el render. Se ajusta al primero disponible
    // si el admin lo saca de countries.
    defaultCountry: "CO",
    // Separador cosmético para tipos numéricos: "none" | "dot" | "comma".
    // El valor guardado en BD siempre viene sin separador.
    thousandsSeparator: "none",
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};
