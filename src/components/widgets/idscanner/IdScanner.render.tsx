import { useRef, useState, useCallback } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import {
  preprocessImage,
  extractByType,
  validatePostOcr,
  type DocumentType,
} from "./IdScanner.ocr";

type ScanStatus = "idle" | "camera" | "processing" | "done" | "error";

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre completo",
  numero: "Número de documento",
  fechaNacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
  fechaExpedicion: "Fecha de expedición",
  lugarExpedicion: "Lugar de expedición",
};

export default function IdScannerRender({ widget, onValue }: WidgetRenderProps) {
  const fields = (widget.config.fields as string[]) || ["nombre", "numero", "fechaNacimiento"];
  const allowManual = (widget.config.allowManual as boolean) ?? true;
  const docType = ((widget.config.documentType as string) || "auto") as DocumentType;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [suspicious, setSuspicious] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const openCamera = useCallback(async () => {
    setError("");
    setStatus("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
      setStatus("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  async function runOcr(canvas: HTMLCanvasElement) {
    setStatus("processing");
    setProgress(0);
    try {
      // Preprocesar antes de OCR (fallback seguro si peta).
      let processed: HTMLCanvasElement = canvas;
      try {
        processed = preprocessImage(canvas);
      } catch {
        // Preprocesamiento no crítico; caer a la imagen original.
      }

      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(processed, "spa", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
        // @ts-expect-error tesseract.js no expone tipo para pageseg_mode
        tessedit_pageseg_mode: "6",
      });
      const data = extractByType(result.data.text, fields, docType);
      const flags = validatePostOcr(data);
      setExtracted(data);
      setSuspicious(flags);
      setStatus("done");
      onValue?.(data);
    } catch {
      setError("Error al procesar la imagen. Intenta de nuevo.");
      setStatus("error");
    }
  }

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    await runOcr(canvas);
  }, [fields, onValue, stopCamera, docType]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Cargar imagen a canvas para poder preprocesar.
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      await runOcr(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No se pudo leer la imagen.");
      setStatus("error");
    };
    img.src = url;
  }, [fields, onValue, docType]);

  const reset = () => {
    setStatus("idle");
    setExtracted({});
    setSuspicious({});
    setError("");
    setProgress(0);
  };

  const btnStyle = (color: string, bg: string) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", borderRadius: 6, border: "none",
    fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", background: bg, color,
  });

  const hasData = Object.keys(extracted).some((k) => extracted[k]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        type="hidden"
        name={widget.id}
        value={hasData ? JSON.stringify(extracted) : ""}
        required={widget.required}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>🪪</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{widget.label}</p>
          {widget.required && <span style={{ fontSize: 12, color: "#ef4444" }}>* Obligatorio</span>}
        </div>
      </div>

      {status === "idle" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={btnStyle("#fff", "#00c2a8")} onClick={openCamera}>📷 Usar cámara</button>
          <label style={{ ...btnStyle("#00a690", "#e6faf7"), cursor: "pointer" }}>
            🖼️ Subir imagen
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {status === "camera" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: "80%", height: "60%", border: "2.5px solid #00c2a8", borderRadius: 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }} />
              <p style={{ color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 20 }}>
                Centra tu cédula dentro del recuadro
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" style={{ ...btnStyle("#fff", "#ef4444"), padding: "12px 28px", borderRadius: 50 }} onClick={capture}>⬤ Capturar</button>
            <button type="button" style={btnStyle("#6b7280", "#f3f4f6")} onClick={() => { stopCamera(); setStatus("idle"); }}>Cancelar</button>
          </div>
        </div>
      )}

      {status === "processing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 24, background: "#f9fafb", borderRadius: 10, textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00c2a8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <p style={{ fontSize: 14, color: "#6b7280" }}>Analizando documento… {progress}%</p>
          <div style={{ width: "100%", maxWidth: 240, height: 6, background: "#e2e8f0", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#00c2a8", borderRadius: 20, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#d1fae5", padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, color: "#065f46" }}>
            <span>✅ Datos extraídos</span>
            <button type="button" style={{ ...btnStyle("#6b7280", "transparent"), padding: "4px 10px", fontSize: 12 }} onClick={reset}>Reintentar</button>
          </div>
          {fields.map((key) => {
            const isSuspicious = suspicious[key] === true;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                  {FIELD_LABELS[key] ?? key}
                  {isSuspicious && (
                    <span title="Verifica este dato" style={{ marginLeft: 6, color: "#d97706" }}>⚠️</span>
                  )}
                </label>
                <input
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1.5px solid ${isSuspicious ? "#fde68a" : "#e2e8f0"}`,
                    borderRadius: 6,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                    background: isSuspicious ? "#fffbeb" : "#fff",
                  }}
                  value={extracted[key] || ""}
                  readOnly={!allowManual}
                  placeholder={`${FIELD_LABELS[key] ?? key} no detectado`}
                  onChange={(e) => {
                    const updated = { ...extracted, [key]: e.target.value };
                    setExtracted(updated);
                    // Re-evaluar sospecha para este campo tras la edición.
                    setSuspicious(validatePostOcr(updated));
                    onValue?.(updated);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, color: "#991b1b" }}>
          <p style={{ marginBottom: 8 }}>⚠️ {error}</p>
          <button type="button" style={btnStyle("#6b7280", "#f3f4f6")} onClick={reset}>Intentar de nuevo</button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
