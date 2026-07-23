import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PdfFromCanvasOptions = {
  margin?: number;
};

/**
 * Renderiza un canvas en un jsPDF paginado en A4 portrait.
 *
 * El ancho del canvas se ajusta al ancho útil de la página A4 menos márgenes;
 * después el contenido se reparte en N páginas según su altura. Esto evita
 * que documentos largos se "aplasten" en una sola página o se corten.
 */
function canvasToPdf(canvas: HTMLCanvasElement, opts: PdfFromCanvasOptions = {}): jsPDF {
  // Margen pequeño (5mm) para que el borde exterior de la tabla del template
  // no quede pegado al borde de la hoja A4. Sin esto los bordes negros de la
  // tabla se cortan visualmente al imprimir.
  const margin = opts.margin ?? 5; // mm
  const imgData = canvas.toDataURL("image/jpeg", 0.85);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();  // 210
  const pageH = pdf.internal.pageSize.getHeight(); // 297
  const usableW = pageW - margin * 2;              // 200
  const usableH = pageH - margin * 2;              // 287

  // El canvas mapea al ancho útil; el alto resulta del aspect ratio
  // — mantenemos la proporción real del contenido para no distorsionarlo.
  const totalH = (canvas.height * usableW) / canvas.width;

  // Si cabe en una sola página, lo colocamos respetando su proporción
  // natural (sin estirar). Si queda espacio en blanco abajo, está bien.
  if (totalH <= usableH) {
    pdf.addImage(imgData, "JPEG", margin, margin, usableW, totalH);
    return pdf;
  }

  // Si el contenido excede una página, paginamos manteniendo el ratio.
  let yOffset = 0;
  while (yOffset < totalH) {
    pdf.addImage(imgData, "JPEG", margin, margin - yOffset, usableW, totalH);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, margin, "F");
    pdf.rect(0, margin + usableH, pageW, pageH - (margin + usableH), "F");
    yOffset += usableH;
    if (yOffset < totalH) pdf.addPage();
  }
  return pdf;
}

/**
 * Espera a que todas las <img> dentro de un documento estén cargadas (o
 * hayan fallado). Sin esto, html2canvas puede medir scrollHeight antes de
 * que las imágenes ocupen su espacio real y cortar el contenido.
 */
function waitForImages(doc: Document, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) return Promise.resolve();

  const promises = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  });

  return Promise.race([
    Promise.all(promises).then(() => undefined),
    // Hard timeout: si alguna imagen externa no responde, no bloqueamos
    // el render indefinidamente.
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Descarga directa: renderiza un elemento del DOM a PDF y dispara la descarga. */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  canvasToPdf(canvas).save(filename);
}

/**
 * Convierte un string HTML completo a PDF y lo devuelve como base64.
 * Monta el HTML en un iframe oculto para aislar sus estilos, espera a que
 * el browser pinte y captura con html2canvas.
 *
 * Pensado para enviar el resultado como attachment de email sin depender de
 * un Puppeteer/Chromium en el servidor.
 */
export async function htmlToPdfBase64(html: string): Promise<string> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-99999px";
  iframe.style.top = "0";
  // Alto inicial mínimo. Lo ajustamos al alto real del contenido después de
  // medir. Antes lo poníamos en 5000px y eso contaminaba documentElement.
  // scrollHeight haciendo creer al PDF que había contenido enorme → páginas
  // en blanco al final.
  iframe.style.width = "794px";
  iframe.style.height = "1px";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("No se pudo crear el documento del iframe");

    // Envolvemos el HTML en una estructura completa con DOCTYPE para forzar
    // standards mode. Sin DOCTYPE el browser entra en quirks mode y
    // scrollHeight/getBoundingClientRect dan valores inconsistentes.
    //
    // El padding superior/inferior de 2px asegura que los bordes con
    // `border-collapse: collapse` (que viven justo en y=0 e y=alto) no se
    // pierdan al pasar por html2canvas → JPEG → PDF.
    const fullDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0 !important; padding: 0 !important; }
  body { width: 794px; box-sizing: border-box; padding: 2px 0 !important; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${html}</body>
</html>`;

    doc.open();
    doc.write(fullDoc);
    doc.close();

    // Esperar load + primer paint.
    await new Promise<void>((r) => {
      iframe.addEventListener("load", () => r(), { once: true });
      setTimeout(() => r(), 300);
    });
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const body = doc.body;

    // Esperar imágenes externas (logo, firmas).
    await waitForImages(doc);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => setTimeout(r, 200));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MEDICIÓN ROBUSTA: en lugar de scrollHeight (que puede subreportar
    // si hay elementos con `position: relative`, márgenes colapsados, etc.),
    // recorremos TODOS los descendientes y nos quedamos con el bottom
    // máximo visto. Esto garantiza que ningún elemento queda fuera.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const all = body.querySelectorAll("*");
    let maxBottom = 0;
    let bottomEl: Element | null = null;
    for (const el of Array.from(all)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.bottom > maxBottom) {
        maxBottom = r.bottom;
        bottomEl = el;
      }
    }
    // Usamos solo maxBottom (rect real de descendientes) y body.scrollHeight.
    // NO usamos doc.documentElement.scrollHeight porque puede heredar el alto
    // del iframe en lugar del alto real del contenido → causa páginas en blanco.
    const measuredH = Math.max(Math.ceil(maxBottom), body.scrollHeight);

    // Buffer de 60px para no cortar la última fila por subpixel/render tardío.
    const captureH = measuredH + 60;
    iframe.style.height = `${captureH}px`;

    const canvas = await html2canvas(body, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 794,
      height: captureH,
      windowWidth: 794,
      windowHeight: captureH,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const cb = clonedDoc.body;
        cb.style.width = "794px";
        cb.style.margin = "0";
        cb.style.padding = "0";
        cb.style.overflow = "visible";
        cb.style.height = "auto";
        clonedDoc.documentElement.style.overflow = "visible";
        clonedDoc.documentElement.style.height = "auto";
      },
    });


    const pdf = canvasToPdf(canvas);
    const arrayBuffer = pdf.output("arraybuffer");
    return arrayBufferToBase64(arrayBuffer);
  } finally {
    document.body.removeChild(iframe);
  }
}
