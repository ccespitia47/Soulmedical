import type { WidgetRenderProps } from "../../../types/widget.types";

export default function NumberRender({ widget }: WidgetRenderProps) {
  const min = (widget.config.min as number) ?? 0;
  const max = (widget.config.max as number) ?? 999999;
  const step = (widget.config.allowDecimals as boolean)
    ? (widget.config.step as number) ?? 0.01
    : (widget.config.step as number) ?? 1;

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="number"
        required={widget.required}
        placeholder={(widget.config.placeholder as string) || ""}
        min={min}
        max={max}
        step={step}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
