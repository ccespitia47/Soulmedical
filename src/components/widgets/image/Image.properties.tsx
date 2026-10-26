import { useRef, useState } from "react";
import Icon from "../../common/Icon";
import { deleteFormAsset, uploadFormAsset } from "../../../services/formAssets";
import type { WidgetPropertiesProps } from "../../../types/widget.types";

const inputStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 5,
};

export default function ImageProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = widget.config.src as string;
  const mediaId = (widget.config.mediaId as string) || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const previousId = mediaId;
    const result = await uploadFormAsset(file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (result.error) {
      setError(result.error);
      return;
    }
    updateWidget(widget.id, {
      config: { ...widget.config, src: result.url, mediaId: result.fileId },
    });
    // Borrar el anterior (si había) — best-effort, no bloquea la UI.
    if (previousId && previousId !== result.fileId) {
      void deleteFormAsset(previousId);
    }
  };

  const handleRemove = () => {
    updateWidget(widget.id, {
      config: { ...widget.config, src: "", mediaId: "" },
    });
    if (fileRef.current) fileRef.current.value = "";
    if (mediaId) void deleteFormAsset(mediaId);
  };

  return (
    <>
      {/* Etiqueta */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Etiqueta</label>
        <input
          style={inputStyle}
          value={widget.label}
          placeholder="Opcional"
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      {/* Recurso */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Recurso</label>
        {src ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <img
              src={src}
              alt="preview"
              style={{
                maxWidth: 160,
                maxHeight: 80,
                objectFit: "contain",
                borderRadius: 7,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#0891b2",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon name="upload" size={13} /> Cambiar
              </button>
              <button
                onClick={handleRemove}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Borrar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1.5px dashed #cbd5e1",
              background: "#f8fafc",
              color: "#6b7280",
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
              width: "100%",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Icon name="upload" size={14} />
            {busy ? "Subiendo…" : "Seleccionar imagen"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        {error && (
          <p
            style={{
              fontSize: 11.5,
              color: "#dc2626",
              margin: "6px 0 0",
              lineHeight: 1.4,
            }}
          >
            {error}
          </p>
        )}
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0" }}>
          Formatos: PNG, JPG, WEBP, GIF · máx. 2 MB.
        </p>
      </div>

      {/* Anchura máxima */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Anchura máxima (px)</label>
        <input
          type="number"
          style={inputStyle}
          value={(widget.config.maxWidth as number) || 180}
          min={20}
          max={1200}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: {
                ...widget.config,
                maxWidth: parseInt(e.target.value) || 180,
              },
            })
          }
        />
      </div>

      {/* Altura máxima */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Altura máxima (px)</label>
        <input
          type="number"
          style={inputStyle}
          placeholder="Sin límite"
          value={(widget.config.maxHeight as number | null) ?? ""}
          min={20}
          max={1200}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            updateWidget(widget.id, {
              config: {
                ...widget.config,
                maxHeight: Number.isFinite(n) ? n : null,
              },
            });
          }}
        />
      </div>

      {/* Clickeable */}
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
          checked={(widget.config.clickable as boolean) ?? false}
          onChange={(e) =>
            updateWidget(widget.id, {
              config: { ...widget.config, clickable: e.target.checked },
            })
          }
        />
        <span>Haz clic para ver la imagen ampliada</span>
      </label>
    </>
  );
}
