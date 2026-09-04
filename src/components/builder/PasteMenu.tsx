import { useEffect, useRef } from "react";
import type { WidgetClipboard } from "../../lib/widgetClone";

type Props = {
  clipboard: WidgetClipboard;
  onPaste: (withRules: boolean) => void;
  onClose: () => void;
};

/**
 * Dropdown que aparece al click en el botón "Pegar" del top-bar del builder.
 * 2 opciones: Pegar (solo widget) / Pegar con reglas (N). Cierra al click
 * fuera o ESC.
 */
export default function PasteMenu({ clipboard, onPaste, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // setTimeout para que el click que abrió el menú no lo cierre inmediatamente.
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#111827",
    textAlign: "left",
    fontFamily: "inherit",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: 40,
        left: 0,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 220,
        zIndex: 30,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => onPaste(false)}
      >
        📋 Pegar (solo widget)
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => onPaste(true)}
      >
        📋 Pegar con reglas ({clipboard.rules.length})
      </button>
    </div>
  );
}
