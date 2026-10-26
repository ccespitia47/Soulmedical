import type { WidgetPropertiesProps } from "../../../types/widget.types";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 7,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#f8fafc",
  color: "#111827",
  boxSizing: "border-box",
  outline: "none",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};

const FILE_TYPES = [
  { value: "documents", label: "Documentos" },
  { value: "images", label: "Imágenes" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "any", label: "Cualquier tipo" },
];

export default function FileProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Tipo de archivo */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Tipo de archivo</label>
        <select
          style={INPUT}
          value={(cfg.fileType as string) || "documents"}
          onChange={(e) => set({ fileType: e.target.value })}
        >
          {FILE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tamaño máximo */}
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Tamaño máximo (MB)</label>
        <input
          type="number"
          style={INPUT}
          min={1}
          max={200}
          value={(cfg.maxSizeMB as number) || 25}
          onChange={(e) =>
            set({ maxSizeMB: parseInt(e.target.value) || 25 })
          }
        />
        <p
          style={{
            fontSize: 11,
            color: "#9ca3af",
            margin: "5px 0 0",
            lineHeight: 1.4,
          }}
        >
          Cap absoluto del servidor: 200 MB.
        </p>
      </div>

      {/* Obligatorio */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#111827",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })}
          style={{ accentColor: "#0891b2" }}
        />
        <span>Obligatorio</span>
      </label>
    </>
  );
}
