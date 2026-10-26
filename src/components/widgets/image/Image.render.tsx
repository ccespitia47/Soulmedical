import { useEffect, useState } from "react";
import Icon from "../../common/Icon";
import type { WidgetRenderProps } from "../../../types/widget.types";

export default function ImageRender({ widget }: WidgetRenderProps) {
  const src = widget.config.src as string;
  const maxWidth = (widget.config.maxWidth as number) || 180;
  const maxHeight = (widget.config.maxHeight as number | null) ?? undefined;
  const clickable = (widget.config.clickable as boolean) ?? false;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  if (!src) return null;

  return (
    <>
      <div style={{ textAlign: "center" }}>
        <img
          src={src}
          alt={widget.label || "Imagen"}
          onClick={clickable ? () => setShowModal(true) : undefined}
          style={{
            width: "100%",
            maxWidth,
            maxHeight,
            height: "auto",
            objectFit: "contain",
            display: "block",
            margin: "0 auto",
            cursor: clickable ? "zoom-in" : "default",
            borderRadius: 4,
          }}
        />
        {widget.label && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            {widget.label}
          </div>
        )}
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={widget.label || "Vista ampliada de imagen"}
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={(e) => {
              e.stopPropagation();
              setShowModal(false);
            }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "none",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <Icon name="x" size={18} />
          </button>
          <img
            src={src}
            alt={widget.label || "Imagen"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: 8,
              cursor: "default",
            }}
          />
        </div>
      )}
    </>
  );
}
