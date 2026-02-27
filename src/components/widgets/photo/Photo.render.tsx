import { useState, useRef } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";

export default function PhotoRender({ widget }: WidgetRenderProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const allowCamera = (widget.config.allowCamera as boolean) ?? true;
  const allowUpload = (widget.config.allowUpload as boolean) ?? true;
  const maxSizeMB = (widget.config.maxSizeMB as number) || 5;

  const handleFile = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`El archivo excede el tamaño máximo de ${maxSizeMB} MB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = "";
  };

  const handleClear = () => {
    setImagePreview(null);
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>

      {!imagePreview ? (
        <>
          <div
            style={{
              width: "100%",
              minHeight: 120,
              border: "1.5px dashed #e2e8f0",
              borderRadius: 6,
              backgroundColor: "#f9fafb",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxSizing: "border-box",
              padding: 16,
              color: "#9ca3af",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span style={{ fontSize: 13 }}>Selecciona o captura una foto</span>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {allowCamera && (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                    backgroundColor: "#00c2a8",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Tomar foto
                </button>
              )}
              {allowUpload && (
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#00c2a8",
                    backgroundColor: "#fff",
                    border: "1.5px solid #00c2a8",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Subir imagen
                </button>
              )}
            </div>
          </div>

          {/* Hidden inputs */}
          {allowCamera && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          )}
          {allowUpload && (
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          )}
        </>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            textAlign: "center",
          }}
        >
          <img
            src={imagePreview}
            alt="Vista previa"
            style={{
              maxWidth: "100%",
              maxHeight: 260,
              borderRadius: 6,
              border: "1.5px solid #e2e8f0",
              objectFit: "contain",
            }}
          />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "#ef4444",
                backgroundColor: "#fff",
                border: "1.5px solid #ef4444",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
