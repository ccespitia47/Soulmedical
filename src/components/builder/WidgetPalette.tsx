import { useState } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { widgetRegistry } from "../widgets/registry";
import Icon from "../common/Icon";

// Tipo de widget → clave de icono SVG (reemplaza los emojis).
const WIDGET_ICONS: Record<string, string> = {
  text: "fileText",
  textarea: "textLines",
  number: "hash",
  email: "mail",
  phone: "phone",
  date: "calendar",
  select: "list",
  checkbox: "checkSquare",
  radio: "radio",
  id_scanner: "idCard",
  signature: "edit",
  photo: "camera",
  header: "type",
  html_block: "code",
  subform: "table",
  search: "search",
  image: "image",
  calc: "calc",
  quiz_question: "help",
  quiz_score: "award",
  file: "file",
  video: "video",
  price: "price",
  id_document: "idCard",
  time: "clock",
};

/** Botón de un widget del palette: tile con icono SVG + label, hover elevado. */
function WidgetButton({
  label,
  iconName,
  onClick,
}: {
  label: string;
  iconName: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        padding: "12px 6px",
        borderRadius: 12,
        border: "1.5px solid transparent",
        background: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.2s ease-out",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "#f0fdfa";
        e.currentTarget.style.borderColor = "rgba(0,194,168,0.35)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 22px -12px rgba(0,194,168,0.55)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 38,
          width: 38,
          borderRadius: 11,
          background: "rgba(0,194,168,0.1)",
          color: "#0891b2",
        }}
      >
        <Icon name={iconName} size={20} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textAlign: "center" }}>
        {label}
      </span>
    </button>
  );
}

const CATEGORIES: { label: string; types: string[] }[] = [
  { label: "BÁSICOS", types: ["text", "textarea", "number", "email", "phone", "date", "time", "price", "id_document"] },
  { label: "SELECCIÓN", types: ["select", "checkbox", "radio"] },
  { label: "AVANZADOS", types: ["id_scanner", "signature", "photo", "file", "video", "subform", "search", "calc"] },
  { label: "DISEÑO", types: ["header", "html_block", "image"] },
  { label: "EVALUACIÓN", types: ["quiz_question", "quiz_score"] },
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "16px 14px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32, width: 32, borderRadius: 10, background: "linear-gradient(135deg,#00c2a8 0%,#0891b2 100%)", color: "#fff", boxShadow: "0 6px 16px -6px rgba(0,194,168,0.6)" }}>
            <Icon name="grid" size={17} />
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: "#0f172a", margin: 0 }}>Widgets</h2>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", width: 30, height: 30, borderRadius: 8 }}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {/* Buscador */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", display: "flex" }}>
            <Icon name="search" size={15} />
          </span>
          <input
            type="text"
            placeholder="Buscar widget..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 10px 8px 32px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#f8fafc", color: "#111827", outline: "none", boxSizing: "border-box" }}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: "4px 8px" }}>
              {filtered.map((def) => (
                <WidgetButton
                  key={def.type}
                  label={def.label}
                  iconName={WIDGET_ICONS[def.type] ?? "grid"}
                  onClick={() => handleAdd(def.type)}
                />
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: "4px 8px" }}>
                {catWidgets.map((def) => (
                  <WidgetButton
                    key={def.type}
                    label={def.label}
                    iconName={WIDGET_ICONS[def.type] ?? "grid"}
                    onClick={() => handleAdd(def.type)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}