import type { WidgetRenderProps } from "../../../types/widget.types";
import { sanitizeHtml } from "../../../utils/sanitize";

export default function HtmlBlockRender({ widget }: WidgetRenderProps) {
  const html = (widget.config.html as string) || "";

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      style={{ width: "100%" }}
    />
  );
}