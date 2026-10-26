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
import { HtmlBlockWidget } from "./htmlblock/HtmlBlockWidget.ts";
import { SubformWidget } from "./subform/SubformWidget";
import type { WidgetDefinition } from "../../types/widget.types";
import { SearchWidget } from "./search/SearchWidget";
import { ImageWidget } from "./image/ImageWidget.ts";
import { CalcWidget } from "./calc/CalcWidget.ts";
import { QuizQuestionWidget } from "./quizQuestion/QuizQuestionWidget.ts";
import { QuizScoreWidget } from "./quizScore/QuizScoreWidget.ts";
import { FileWidget } from "./file/FileWidget.ts";
import { VideoWidget } from "./video/VideoWidget.ts";
import { PriceWidget } from "./price/PriceWidget.ts";
import { IdDocumentWidget } from "./idDocument/IdDocumentWidget.ts";
import { TimeWidget } from "./time/TimeWidget.ts";

export const widgetRegistry: Record<string, WidgetDefinition> = {
  // Básicos
  text: TextWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  email: EmailWidget,
  phone: PhoneWidget,
  date: DateWidget,
  time: TimeWidget,
  price: PriceWidget,
  id_document: IdDocumentWidget,
  // Selección
  select: SelectWidget,
  checkbox: CheckboxWidget,
  radio: RadioWidget,
  // Avanzados
  id_scanner: IdScannerWidget,
  signature: SignatureWidget,
  photo: PhotoWidget,
  subform: SubformWidget,
  search: SearchWidget,
  calc: CalcWidget,
  file: FileWidget,
  video: VideoWidget,
  // Diseño
  header: HeaderWidget,
  html_block: HtmlBlockWidget,
  image: ImageWidget,
  // Evaluación
  quiz_question: QuizQuestionWidget,
  quiz_score: QuizScoreWidget,
};