import { useEffect, useRef, useState } from "react";
import Icon from "../../common/Icon";
import {
  deleteSubmissionFile,
  uploadSubmissionFile,
} from "../../../services/submissionUploads";
import type { WidgetRenderProps } from "../../../types/widget.types";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")} min` : `${s}s`;
}

export default function VideoRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const maxDurationSecs = (cfg.maxDurationSecs as number) || 60;
  const maxSizeMB = (cfg.maxSizeMB as number) || 100;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [size, setSize] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileId, setFileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Blob URL local para preview mientras el video está seleccionado —
  // se libera al desmontar o al cambiar de archivo.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitValue = fileId ? `gridfs:${fileId}` : "";

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setName("");
    setSize(0);
    setDuration(0);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El video excede el tamaño máximo de ${maxSizeMB} MB`);
      e.target.value = "";
      return;
    }

    const url = URL.createObjectURL(f);

    // Validamos duración antes de subir — si excede, no gastamos ancho de banda.
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onloadedmetadata = async () => {
      if (vid.duration > maxDurationSecs) {
        setError(
          `El video excede la duración máxima de ${formatDuration(maxDurationSecs)}`,
        );
        URL.revokeObjectURL(url);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      // OK: preview + upload en paralelo (el user ve el video mientras sube).
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setName(f.name);
      setSize(f.size);
      setDuration(vid.duration);
      setBusy(true);

      const previous = fileId;
      const res = await uploadSubmissionFile(f);
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (res.error) {
        setError(res.error);
        clearAll();
        return;
      }
      setFileId(res.fileId);
      if (previous) void deleteSubmissionFile(previous);
    };
    vid.onerror = () => {
      setError("No se pudo leer el video seleccionado");
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = "";
    };
  };

  const handleRemove = () => {
    if (fileId) void deleteSubmissionFile(fileId);
    setFileId("");
    setError("");
    clearAll();
  };

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

      <input type="hidden" name={widget.id} value={submitValue} />

      {!name ? (
        <div
          onClick={() => !busy && fileRef.current?.click()}
          style={{
            border: "1.5px dashed #cbd5e1",
            borderRadius: 8,
            padding: "26px 12px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: busy ? "wait" : "pointer",
            transition: "border-color 0.2s, background 0.2s",
          }}
          onMouseOver={(e) => {
            if (busy) return;
            (e.currentTarget as HTMLDivElement).style.borderColor = "#0891b2";
            (e.currentTarget as HTMLDivElement).style.background = "#ecfeff";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#cbd5e1";
            (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
          }}
        >
          <span style={{ color: "#0891b2" }}>
            <Icon name="video" size={30} />
          </span>
          <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
            Añadir video
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Máx. {formatDuration(maxDurationSecs)} · {maxSizeMB} MB
          </span>
        </div>
      ) : (
        <div
          style={{
            border: "1.5px solid #a7f3d0",
            borderRadius: 8,
            overflow: "hidden",
            background: "#f0fdf4",
          }}
        >
          <video
            src={previewUrl}
            controls
            style={{
              width: "100%",
              maxHeight: 260,
              display: "block",
              background: "#000",
            }}
          />
          <div
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 240,
                }}
              >
                {name}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {formatSize(size)} · {formatDuration(duration)}{" "}
                {busy ? "· subiendo…" : fileId ? "· subido" : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: "#fee2e2",
                color: "#ef4444",
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", margin: "6px 0 0" }}>
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </div>
  );
}
