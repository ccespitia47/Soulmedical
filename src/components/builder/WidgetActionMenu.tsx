import { useEffect, useRef } from "react";

type Props = {
  onDuplicate: () => void;
  onDuplicateWithRules: () => void;
  onCopy: () => void;
  onCopyWithRules: () => void;
  onClose: () => void;
};

/**
 * Dropdown que aparece al hacer click en el botón ⋮ de un widget del canvas.
 * 4 opciones: Duplicar (solo widget) / Duplicar con reglas / Copiar / Copiar con reglas.
 * Cierra al click fuera o al presionar ESC.
 */
export default function WidgetActionMenu({
  onDuplicate,
  onDuplicateWithRules,
  onCopy,
  onCopyWithRules,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 32,
        right: 8,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 220,
        zIndex: 20,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onDuplicate(); onClose(); }}
      >
        <span>🗂️</span>
        <span>Duplicar</span>
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onDuplicateWithRules(); onClose(); }}
      >
        <span>🗂️</span>
        <span>Duplicar con reglas</span>
      </button>
      <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onCopy(); onClose(); }}
      >
        <span>📋</span>
        <span>Copiar</span>
      </button>
      <button
        type="button"
        style={itemStyle}
        onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
        onClick={() => { onCopyWithRules(); onClose(); }}
      >
        <span>📋</span>
        <span>Copiar con reglas</span>
      </button>
    </div>
  );
}
