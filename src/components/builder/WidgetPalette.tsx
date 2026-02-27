import { useState } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { widgetRegistry } from "../widgets/registry";

const WIDGET_ICONS: Record<string, string> = {
  text: "📝",
  textarea: "📄",
  number: "🔢",
  email: "✉️",
  phone: "📞",
  date: "📅",
  select: "📋",
  checkbox: "☑️",
  radio: "🔘",
  id_scanner: "🪪",
  signature: "✍️",
  photo: "📷",
  header: "🏷️",
};

const CATEGORIES: { label: string; types: string[] }[] = [
  { label: "BÁSICOS", types: ["text", "textarea", "number", "email", "phone", "date"] },
  { label: "SELECCIÓN", types: ["select", "checkbox", "radio"] },
  { label: "AVANZADOS", types: ["id_scanner", "signature", "photo"] },
  { label: "DISEÑO", types: ["header"] },
];

export default function WidgetPalette({ onClose }: { onClose?: () => void }) {
  const addWidget = useBuilderStore((s) => s.addWidget);
  const [search, setSearch] = useState("");

  const handleAdd = (type: string) => {
    addWidget(type);
    onClose?.();
  };

  const allWidgets = Object.values(widgetRegistry);
  const isSearching = search.trim().length > 0;

  const filtered = allWidgets.filter((w) =>
    w.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 10px", borderBottom: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Widgets</h2>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", width: 28, height: 28, borderRadius: 6 }}>✕</button>
        )}
      </div>

      {/* Buscador */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar widget..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 10px 7px 32px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#f8fafc", color: "#111827", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* Contenido scrollable */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Modo búsqueda: lista plana */}
        {isSearching && (
          <>
            <div style={{ padding: "12px 14px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase" }}>
              RESULTADOS ({filtered.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: "4px 8px" }}>
              {filtered.map((def) => (
                <button
                  key={def.type}
                  onClick={() => handleAdd(def.type)}
                  title={def.label}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 6px", borderRadius: 8, border: "1.5px solid transparent", background: "none", cursor: "pointer", fontFamily: "inherit" }}
                  onMouseOver={(e) => { e.currentTarget.style.background = "#e6faf7"; e.currentTarget.style.borderColor = "rgba(0,194,168,0.3)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <span style={{ fontSize: 24 }}>{WIDGET_ICONS[def.type] ?? "🔧"}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textAlign: "center" }}>{def.label}</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <p style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                Sin resultados para "{search}"
              </p>
            )}
          </>
        )}

        {/* Modo normal: por categorías */}
        {!isSearching && CATEGORIES.map((cat) => {
          const catWidgets = cat.types
            .map((t) => widgetRegistry[t])
            .filter(Boolean);

          if (catWidgets.length === 0) return null;

          return (
            <div key={cat.label}>
              <div style={{ padding: "12px 14px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase" }}>
                {cat.label}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: "4px 8px" }}>
                {catWidgets.map((def) => (
                  <button
                    key={def.type}
                    onClick={() => handleAdd(def.type)}
                    title={def.label}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 6px", borderRadius: 8, border: "1.5px solid transparent", background: "none", cursor: "pointer", fontFamily: "inherit" }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#e6faf7"; e.currentTarget.style.borderColor = "rgba(0,194,168,0.3)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <span style={{ fontSize: 24 }}>{WIDGET_ICONS[def.type] ?? "🔧"}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", textAlign: "center" }}>{def.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
