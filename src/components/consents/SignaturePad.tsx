import { useCallback, useEffect, useRef, useState } from "react";

type SignaturePadProps = {
  /** Se invoca con el data URL (PNG) cada vez que cambia el trazo, o "" al limpiar. */
  onChange: (dataUrl: string) => void;
  /** Fuerza limpiar el canvas cuando cambia (p. ej. al reiniciar el formulario). */
  resetKey?: number;
  /**
   * Firma ya existente a dibujar al montar (modo edición, Task 6). Solo se
   * pinta una vez al montar el componente (igual que el resto del pad, es
   * "no controlado" después de eso): el usuario puede seguir dibujando o
   * limpiar con normalidad.
   */
  initialDataUrl?: string;
};

// Pad de firma con mouse y touch. Aislado y reutilizable (Atomic Design).
export default function SignaturePad({ onChange, resetKey = 0, initialDataUrl }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPosition = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
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
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPosition(e);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getPosition],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }, [onChange]);

  // Ajustar la resolución del canvas a su tamaño en pantalla y, si viene una
  // firma inicial (modo edición), dibujarla. Deps vacías a propósito: solo
  // importa al montar, igual que `resetKey` — un remount (`key` distinta en
  // el padre) es la forma establecida de refrescar el contenido inicial.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (initialDataUrl) {
        const img = new Image();
        img.onload = () => {
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = initialDataUrl;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpiar cuando el padre cambia resetKey.
  useEffect(() => {
    if (resetKey === 0) return;
    clearCanvas();
  }, [resetKey, clearCanvas]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="block h-[160px] w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
      />
      <button
        type="button"
        onClick={clearCanvas}
        className="mt-2 rounded-md border-[1.5px] border-[#00c2a8] bg-transparent px-4 py-1.5 text-[13px] font-medium text-[#00c2a8] transition-colors hover:bg-[#00c2a8]/5"
      >
        Limpiar firma
      </button>
    </div>
  );
}
