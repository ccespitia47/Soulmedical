import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PdfFromCanvasOptions = {
  margin?: number;
  /**
   * Posiciones (en px del canvas, desde arriba) donde SÍ se puede cortar entre
   * páginas: inicio de cada fila de tabla, párrafo y bloque. Sin ellas la
   * paginación corta cada 287mm a ciegas y parte filas y títulos por la mitad.
   */
  breakOffsets?: number[];
};

/** Mayor corte seguro que cae dentro de (start, limit]; `null` si no hay. */
function lastBreakWithin(breaks: number[], start: number, limit: number): number | null {
  let found: number | null = null;
  for (const b of breaks) {
    if (b > limit) break; // `breaks` viene ordenado ascendentemente
    if (b > start) found = b;
  }
  return found;
}

/**
 * Renderiza un canvas en un jsPDF paginado en A4 portrait.
 *
 * El ancho del canvas se ajusta al ancho útil de la página A4 menos márgenes;
 * después el contenido se reparte en N páginas según su altura. Esto evita
 * que documentos largos se "aplasten" en una sola página o se corten.
 *
 * Con `breakOffsets` cada página termina en el último corte seguro que quepa,
 * así que ninguna fila ni bloque queda partido entre dos hojas; el hueco que
 * sobra al pie se deja en blanco.
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

  // Cortes seguros expresados en mm del documento ya escalado, ordenados y
  // sin duplicados (dos elementos pueden empezar en la misma y).
  const pxToMm = usableW / canvas.width;
  const breaks = Array.from(
    new Set(
      (opts.breakOffsets ?? [])
        .map((px) => Math.round(px * pxToMm * 100) / 100)
        .filter((mm) => mm > 0 && mm < totalH),
    ),
  ).sort((a, b) => a - b);

  // Si el contenido excede una página, paginamos manteniendo el ratio.
  let start = 0;
  // Tolerancia subpíxel: por debajo de ~0.2mm no queda contenido real que
  // justifique otra página (evita una hoja final en blanco).
  while (start < totalH - 0.2) {
    const limit = start + usableH;
    let end = Math.min(limit, totalH);
    if (limit < totalH) {
      const safe = lastBreakWithin(breaks, start, limit);
      // Si no hay ningún corte seguro en la página, el bloque es más alto que
      // una hoja: cortamos en el límite para no entrar en bucle infinito.
      if (safe !== null) end = safe;
    }

    pdf.addImage(imgData, "JPEG", margin, margin - start, usableW, totalH);
    // Tapamos en blanco lo que no pertenece a esta página: el margen superior
    // y todo lo que quede por debajo del corte elegido.
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, margin, "F");
    const printedH = end - start;
    pdf.rect(0, margin + printedH, pageW, pageH - (margin + printedH), "F");

    start = end;
    if (start < totalH - 0.2) pdf.addPage();
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

/** Factor de muestreo de html2canvas: 1 px de layout → `CAPTURE_SCALE` px de
 *  canvas. Los cortes de página se miden en px de layout, así que hay que
 *  escalarlos con esta misma constante antes de pasarlos a `canvasToPdf`. */
const CAPTURE_SCALE = 1.5;

/** Selector de los elementos ante los cuales se puede abrir página. */
const BREAK_SELECTOR = "[data-pdf-block], [data-pdf-break], tr, p, li";

/**
 * Devuelve las `y` (px de layout, relativas al inicio del contenido) donde el
 * documento se puede partir entre páginas: el borde superior de cada bloque,
 * fila de tabla o párrafo.
 *
 * Se descartan los cortes que caerían justo debajo de un encabezado marcado
 * con `data-pdf-keep-next` (barra de sección, fila de cabecera de tabla): si
 * la página terminara ahí, el título quedaría solo al pie y su contenido
 * empezaría en la hoja siguiente.
 */
function collectBreakOffsets(body: HTMLElement): number[] {
  const bodyTop = body.getBoundingClientRect().top;

  // Zonas prohibidas: desde el inicio de cada encabezado hasta un poco después
  // de su base, para que arrastre consigo al menos la primera fila/párrafo.
  const KEEP_WITH_NEXT_PX = 30;
  const forbidden: Array<[number, number]> = [];
  for (const el of Array.from(body.querySelectorAll<HTMLElement>("[data-pdf-keep-next]"))) {
    const r = el.getBoundingClientRect();
    forbidden.push([r.top - bodyTop + 0.5, r.bottom - bodyTop + KEEP_WITH_NEXT_PX]);
  }

  const offsets: number[] = [];
  for (const el of Array.from(body.querySelectorAll<HTMLElement>(BREAK_SELECTOR))) {
    const top = el.getBoundingClientRect().top - bodyTop;
    if (top <= 0) continue;
    if (forbidden.some(([from, to]) => top > from && top < to)) continue;
    offsets.push(top);
  }
  return offsets.sort((a, b) => a - b);
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
    for (const el of Array.from(all)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    }
    // Usamos solo maxBottom (rect real de descendientes) y body.scrollHeight.
    // NO usamos doc.documentElement.scrollHeight porque puede heredar el alto
    // del iframe en lugar del alto real del contenido → causa páginas en blanco.
    const measuredH = Math.max(Math.ceil(maxBottom), body.scrollHeight);

    // Buffer de 60px para no cortar la última fila por subpixel/render tardío.
    const captureH = measuredH + 60;
    iframe.style.height = `${captureH}px`;

    // Puntos donde se puede partir el documento sin romper nada (ver
    // `collectBreakOffsets`). Se miden ANTES de html2canvas, sobre el layout
    // real del iframe, y se escalan al tamaño del canvas.
    const breakOffsetsPx = collectBreakOffsets(body);

    const canvas = await html2canvas(body, {
      scale: CAPTURE_SCALE,
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


    const pdf = canvasToPdf(canvas, {
      breakOffsets: breakOffsetsPx.map((px) => px * CAPTURE_SCALE),
    });
    const arrayBuffer = pdf.output("arraybuffer");
    return arrayBufferToBase64(arrayBuffer);
  } finally {
    document.body.removeChild(iframe);
  }
}
