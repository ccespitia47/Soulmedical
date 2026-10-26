import { useEffect, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import { normalizeRadioOptions } from "./radioOptions";

const STORAGE_KEY = (widgetId: string) => `soulforms_radio_${widgetId}`;

export default function RadioRender({ widget, hiddenWidgetIds }: WidgetRenderProps) {
  const cfg = widget.config;
  const allOptions = normalizeRadioOptions(cfg.options);
  // Oculta opciones individuales marcadas por reglas vía ID compuesto
  // `${widget.id}::${label}` (coincide con lo que escribe RuleTargetSelector).
  const options = hiddenWidgetIds
    ? allOptions.filter((o) => !hiddenWidgetIds.has(`${widget.id}::${o.label}`))
    : allOptions;
  const defaultValue = (cfg.defaultValue as string) || "";
  const useImageLabels = (cfg.useImageLabels as boolean) ?? false;
  const verticalAlign = (cfg.verticalAlign as boolean) ?? true;
  const rememberInput = (cfg.rememberInput as boolean) ?? false;

  const [selected, setSelected] = useState<string>(() => {
    if (rememberInput) {
      const stored = localStorage.getItem(STORAGE_KEY(widget.id));
      if (stored) return stored;
    }
    return defaultValue;
  });

  useEffect(() => {
    if (rememberInput && selected) {
      localStorage.setItem(STORAGE_KEY(widget.id), selected);
    }
  }, [rememberInput, selected, widget.id]);

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: "#111827",
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>

      <div
        style={{
          display: verticalAlign ? "flex" : "grid",
          flexDirection: verticalAlign ? "column" : undefined,
          gridTemplateColumns: verticalAlign
            ? undefined
            : "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        {options.map((opt, index) => {
          const isSelected = selected === opt.label;
          return (
            <label
              key={opt.id}
              style={{
                display: "flex",
                alignItems: useImageLabels && opt.imageUrl ? "flex-start" : "center",
                gap: 10,
                padding: useImageLabels && opt.imageUrl ? 10 : "8px 12px",
                border: isSelected
                  ? "1.5px solid #0891b2"
                  : "1.5px solid #e2e8f0",
                borderRadius: 8,
                background: isSelected ? "#ecfeff" : "#f8fafc",
                cursor: "pointer",
                fontSize: 13.5,
                color: "#111827",
                transition: "all 0.15s ease-out",
              }}
            >
              <input
                type="radio"
                name={widget.id}
                value={opt.label}
                required={widget.required && index === 0}
                checked={isSelected}
                onChange={() => setSelected(opt.label)}
                style={{ accentColor: "#0891b2", marginTop: useImageLabels && opt.imageUrl ? 4 : 0 }}
              />
              {useImageLabels && opt.imageUrl && (
                <img
                  src={opt.imageUrl}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "contain",
                    borderRadius: 6,
                    background: "white",
                    border: "1px solid #e2e8f0",
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ flex: 1 }}>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
