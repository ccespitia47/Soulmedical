import { useEffect, useState } from "react";
import Icon from "../../common/Icon";
import type { WidgetRenderProps } from "../../../types/widget.types";

const STORAGE_KEY = (widgetId: string) => `soulforms_time_${widgetId}`;

/** HH:MM del reloj del cliente en formato input[type=time]. */
function nowHHMM(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function TimeRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const nowByDefault = (cfg.nowByDefault as boolean) ?? false;
  const rememberInput = (cfg.rememberInput as boolean) ?? false;

  // Resolución del valor inicial:
  // 1. Si `rememberInput` está activo y hay algo guardado, prevalece.
  // 2. Si no, y `nowByDefault` está activo, la hora del cliente al montar.
  // 3. En cualquier otro caso, vacío.
  const [value, setValue] = useState<string>(() => {
    if (rememberInput) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY(widget.id));
        if (stored) return stored;
      } catch {
        /* localStorage bloqueado — seguimos sin valor */
      }
    }
    return nowByDefault ? nowHHMM() : "";
  });

  useEffect(() => {
    if (!rememberInput || !value) return;
    try {
      localStorage.setItem(STORAGE_KEY(widget.id), value);
    } catch {
      /* ignore */
    }
  }, [value, rememberInput, widget.id]);

  // Estado de foco solo para el realce visual (anillo + badge teal). No
  // interviene en la lógica del valor ni del envío.
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 7,
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
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 13px",
          border: `1.5px solid ${focused ? "#00c2a8" : "#e2e8f0"}`,
          borderRadius: 11,
          background: focused ? "#ffffff" : "#f8fafc",
          boxShadow: focused
            ? "0 0 0 3px rgba(0,194,168,0.16), 0 4px 14px -8px rgba(0,194,168,0.5)"
            : "0 1px 2px rgba(15,23,42,0.04)",
          transition:
            "border-color .18s ease, box-shadow .18s ease, background .18s ease",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: 9,
            background: focused
              ? "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)"
              : "#e6f7f4",
            color: focused ? "#ffffff" : "#0891b2",
            transition: "background .18s ease, color .18s ease",
          }}
        >
          <Icon name="clock" size={16} />
        </span>
        <input
          type="time"
          name={widget.id}
          required={widget.required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "2px 0",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14.5,
            fontFamily: "inherit",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
            color: "#0f172a",
          }}
        />
      </div>
    </div>
  );
}
