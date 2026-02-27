import { TextWidget } from "./text/TextWidget.ts";
import { TextareaWidget } from "./textarea/TextareaWidget.ts";
import { NumberWidget } from "./number/NumberWidget.ts";
import { EmailWidget } from "./email/EmailWidget.ts";
import { PhoneWidget } from "./phone/PhoneWidget.ts";
import { DateWidget } from "./date/DateWidget.ts";
import { SelectWidget } from "./select/SelectWidget.ts";
import { CheckboxWidget } from "./checkbox/CheckboxWidget.ts";
import { RadioWidget } from "./radio/RadioWidget.ts";
import { IdScannerWidget } from "./idscanner/IdScannerWidget.ts";
import { SignatureWidget } from "./signature/SignatureWidget.ts";
import { PhotoWidget } from "./photo/PhotoWidget.ts";
import { HeaderWidget } from "./header/HeaderWidget.ts";
import type { WidgetDefinition } from "../../types/widget.types";

export const widgetRegistry: Record<string, WidgetDefinition> = {
  // Básicos
  text: TextWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  email: EmailWidget,
  phone: PhoneWidget,
  date: DateWidget,
  // Selección
  select: SelectWidget,
  checkbox: CheckboxWidget,
  radio: RadioWidget,
  // Avanzados
  id_scanner: IdScannerWidget,
  signature: SignatureWidget,
  photo: PhotoWidget,
  // Diseño
  header: HeaderWidget,
};
