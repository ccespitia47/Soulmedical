import type { WidgetRenderProps } from "../../../types/widget.types";

export default function HtmlBlockRender({ widget }: WidgetRenderProps) {
  const html = (widget.config.html as string) || "";

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ width: "100%" }}
    />
  );
}