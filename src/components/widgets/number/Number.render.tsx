import type { WidgetRenderProps } from "../../../types/widget.types";

export default function NumberRender({ widget }: WidgetRenderProps) {
  const config = widget.config ?? {};
  const min = (config.min as number) ?? 0;
  const max = (config.max as number) ?? 999999;
  const step = (config.allowDecimals as boolean)
    ? (config.step as number) ?? 0.01
    : (config.step as number) ?? 1;

  const rawDefault = config.defaultValue;
  const defaultValue =
    rawDefault === undefined || rawDefault === null || rawDefault === ""
      ? ""
      : String(rawDefault);

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="number"
        name={widget.id}
        required={widget.required}
        placeholder={(config.placeholder as string) || ""}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
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
