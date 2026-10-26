import type { WidgetPreviewProps } from "../../../types/widget.types";

type QuizOption = { id: string; label: string; points: number; correct: boolean };

export default function QuizQuestionPreview({ widget }: WidgetPreviewProps) {
  const options: QuizOption[] = (widget.config.options as QuizOption[]) || [];
  const mode = (widget.config.mode as string) || "single";
  const scoreMode = (widget.config.scoreMode as string) || "correct";

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#111827",
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.length === 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Sin opciones configuradas.
          </p>
        )}
        {options.slice(0, 4).map((opt) => (
          <div
            key={opt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "#374151",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: mode === "single" ? 999 : 3,
                border: "1.5px solid #cbd5e1",
                background: "white",
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{opt.label}</span>
            {scoreMode === "weighted" && (
              <span
                style={{
                  fontSize: 10.5,
                  color: "#0891b2",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {opt.points} pts
              </span>
            )}
          </div>
        ))}
        {options.length > 4 && (
          <p
            style={{
              fontSize: 11,
              color: "#9ca3af",
              margin: 0,
              paddingLeft: 22,
            }}
          >
            +{options.length - 4} más
          </p>
        )}
      </div>
    </div>
  );
}
