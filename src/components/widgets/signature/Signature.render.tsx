import { useRef, useState, useCallback, useEffect } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";

export default function SignatureRender({ widget }: WidgetRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState("");

  const penColor = (widget.config.penColor as string) || "#000000";
  const penWidth = (widget.config.penWidth as number) || 2;

  // Si llegó una firma desde un paso anterior (data URL en defaultValue),
  // la mostramos como imagen read-only en lugar del canvas. Cada destinatario
  // solo puede firmar si su widget aún no tiene firma.
  const inherited = ((widget.config.defaultValue as string) || "").trim();
  const hasInheritedSignature = inherited.startsWith("data:image/");

  const getPosition = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const { x, y } = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    },
    [getPosition],
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const { x, y } = getPosition(e);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getPosition, penColor, penWidth],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL("image/png"));
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  }, []);

  useEffect(() => {
    if (hasInheritedSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [hasInheritedSignature]);

  if (hasInheritedSignature) {
    return (
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {widget.label}
          {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
        </label>
        <div
          style={{
            border: "1.5px solid #d1fae5",
            borderRadius: 6,
            background: "#f0fdf4",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#065f46",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              alignSelf: "flex-start",
            }}
          >
            ✓ Firmado en un paso anterior
          </div>
          <img
            src={inherited}
            alt="Firma del paso anterior"
            style={{
              maxWidth: "100%",
              maxHeight: 140,
              objectFit: "contain",
              background: "#fff",
              borderRadius: 4,
              padding: 8,
            }}
          />
        </div>
        {/* Hidden input para reenviar el mismo valor heredado al backend */}
        <input type="hidden" name={widget.id} value={inherited} readOnly />
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {widget.label}
        {widget.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{
          width: "100%",
          height: 150,
          border: "2px dashed #e2e8f0",
          borderRadius: 6,
          cursor: "crosshair",
          touchAction: "none",
          boxSizing: "border-box",
          display: "block",
        }}
      />
      <input type="hidden" name={widget.id} value={signatureData} readOnly />
      <button
        type="button"
        onClick={clearCanvas}
        style={{
          marginTop: 8,
          padding: "6px 16px",
          fontSize: 13,
          fontFamily: "inherit",
          color: "#00c2a8",
          backgroundColor: "transparent",
          border: "1.5px solid #00c2a8",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Limpiar firma
      </button>
    </div>
  );
}
