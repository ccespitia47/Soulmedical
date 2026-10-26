import { useRef, useState } from "react";
import Icon from "../../common/Icon";
import {
  deleteSubmissionFile,
  uploadSubmissionFile,
} from "../../../services/submissionUploads";
import type { WidgetRenderProps } from "../../../types/widget.types";

const ACCEPT_MAP: Record<string, string> = {
  documents: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods",
  images: "image/*",
  audio: "audio/*",
  video: "video/*",
  any: "",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const fileType = (cfg.fileType as string) || "documents";
  const maxSizeMB = (cfg.maxSizeMB as number) || 25;
  const accept = ACCEPT_MAP[fileType] ?? "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<number>(0);
  const [fileId, setFileId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitValue = fileId ? `gridfs:${fileId}` : "";

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");

    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede el tamaño máximo de ${maxSizeMB} MB`);
      e.target.value = "";
      return;
    }

    setSelectedName(f.name);
    setSelectedSize(f.size);
    setBusy(true);

    // Si había un upload previo, lo eliminamos para no dejar huérfano.
    const previous = fileId;
    const res = await uploadSubmissionFile(f);
    setBusy(false);
    e.target.value = "";
    if (res.error) {
      setError(res.error);
      setSelectedName("");
      setSelectedSize(0);
      return;
    }
    setFileId(res.fileId);
    if (previous) void deleteSubmissionFile(previous);
  };

  const handleRemove = () => {
    if (fileId) void deleteSubmissionFile(fileId);
    setFileId("");
    setSelectedName("");
    setSelectedSize(0);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
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

      {/* Hidden input con la referencia GridFS — el backend detecta el
          prefijo `gridfs:` y NO re-procesa. */}
      <input type="hidden" name={widget.id} value={submitValue} />

      {!fileId ? (
        <div
          onClick={() => !busy && fileRef.current?.click()}
          style={{
            border: "1.5px dashed #cbd5e1",
            borderRadius: 8,
            padding: "20px 12px",
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
            <Icon name="file" size={26} />
          </span>
          <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
            {busy ? `Subiendo ${selectedName}…` : "Selecciona un archivo"}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Máximo {maxSizeMB} MB
          </span>
        </div>
      ) : (
        <div
          style={{
            border: "1.5px solid #a7f3d0",
            borderRadius: 8,
            padding: "12px 14px",
            background: "#f0fdf4",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "#059669" }}>
            <Icon name="file" size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedName}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {formatSize(selectedSize)} · subido
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "none",
              background: "#fee2e2",
              color: "#ef4444",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Borrar
          </button>
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
        accept={accept}
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </div>
  );
}
