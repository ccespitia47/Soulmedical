import Preview from "./Search.preview";
import Properties from "./Search.properties";
import Render from "./Search.render";
import type { WidgetDefinition } from "../../../types/widget.types";

export const SearchWidget: WidgetDefinition = {
  type: "search",
  label: "Búsqueda",
  icon: "search",
  defaultConfig: {
    sourceType: "form_submissions",
    placeholder: "Buscar...",
    minChars: 2,
    displayColumns: [],
    fieldMappings: [],
    searchableFields: [],
  },
  preview: Preview,
  properties: Properties,
  render: Render,
};