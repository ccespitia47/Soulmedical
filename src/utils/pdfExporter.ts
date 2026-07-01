import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgW = canvas.width;
  const imgH = canvas.height;
  const isLandscape = imgW > imgH;

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "px",
    format: "a4",
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const scale = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);

  pdf.addImage(imgData, "PNG", margin, margin, imgW * scale, imgH * scale);
  pdf.save(filename);
}
