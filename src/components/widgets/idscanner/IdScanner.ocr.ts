export type DocumentType = "auto" | "cc" | "ce" | "ti" | "passport";

type ExtractResult = { fields: Record<string, string>; matchCount: number };

// ─── Preprocesamiento de imagen (canvas nativo) ─────────────────────────────
// El pipeline: upscale si es pequeña → grayscale → autolevel → binarización.
// Todo se aplica in-place sobre el canvas (o uno nuevo si upscale). Coste:
// < 100ms para 1920x1080. Sin dependencias externas.
export function preprocessImage(source: HTMLCanvasElement): HTMLCanvasElement {
  const upscaled = source.width < 1600 ? upscale(source, 2) : source;
  const ctx = upscaled.getContext("2d");
  if (!ctx) return upscaled;
  const imgData = ctx.getImageData(0, 0, upscaled.width, upscaled.height);
  const data = imgData.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    data[i] = data[i + 1] = data[i + 2] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((data[i] - min) * 255) / range;
    const binary = stretched < 180 ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = binary;
  }

  ctx.putImageData(imgData, 0, 0);
  return upscaled;
}

function upscale(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width * factor;
  out.height = source.height * factor;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

// ─── Extracción por tipo de documento ───────────────────────────────────────

function extractCC(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (wantedFields.includes("numero")) {
    const dotted = text.match(/\b\d{1,3}(?:[.\s]\d{3}){2,3}\b/);
    if (dotted) {
      const num = dotted[0].replace(/[.\s]/g, "");
      if (num.length >= 6 && num.length <= 12) result.numero = num;
    } else {
      const plain = text.match(/\b\d{6,12}\b/);
      if (plain) result.numero = plain[0];
    }
  }

  if (wantedFields.includes("nombre")) {
    const nameLine = lines.find((l) =>
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,}$/.test(l),
    );
    if (nameLine) result.nombre = nameLine;
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  if (wantedFields.includes("sexo")) {
    const upper = text.toUpperCase();
    if (upper.includes("MASCULINO") || /\bM\b/.test(upper)) result.sexo = "Masculino";
    else if (upper.includes("FEMENINO") || /\bF\b/.test(upper)) result.sexo = "Femenino";
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function extractCE(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (wantedFields.includes("numero")) {
    const m = text.match(/\b[A-Z0-9]{6,12}\b/);
    if (m && /\d/.test(m[0])) result.numero = m[0];
  }

  if (wantedFields.includes("nombre")) {
    const nameLine = lines.find((l) =>
      /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,}$/.test(l),
    );
    if (nameLine) result.nombre = nameLine;
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function extractTI(text: string, wantedFields: string[]): ExtractResult {
  return extractCC(text, wantedFields);
}

function extractPassport(text: string, wantedFields: string[]): ExtractResult {
  const result: Record<string, string> = {};
  const mrzMatch = text.match(/^P<[A-Z]{3}[A-Z<]+/m);
  if (mrzMatch) {
    const line1 = mrzMatch[0];
    const namesPart = line1.slice(5);
    const [surname, ...givenParts] = namesPart.split("<<");
    if (wantedFields.includes("nombre")) {
      const surnameClean = surname.replace(/</g, " ").trim();
      const givenClean = (givenParts.join(" ") ?? "").replace(/</g, " ").trim();
      const full = `${givenClean} ${surnameClean}`.trim();
      if (full.length > 3) result.nombre = full;
    }
    if (wantedFields.includes("numero")) {
      const lines = text.split("\n");
      const idx = lines.findIndex((l) => l.startsWith("P<"));
      const line2 = lines[idx + 1] ?? "";
      const num = line2.match(/^[A-Z0-9]{6,9}/);
      if (num) result.numero = num[0];
    }
  } else {
    const generic = extractCC(text, wantedFields);
    Object.assign(result, generic.fields);
  }

  if (wantedFields.includes("fechaNacimiento")) {
    const d = pickBestDate(text);
    if (d) result.fechaNacimiento = d;
  }

  return { fields: result, matchCount: Object.keys(result).length };
}

function pickBestDate(text: string): string | null {
  const matches = [...text.matchAll(
    /\b(\d{1,2})[/\-\s](\d{1,2})[/\-\s](\d{2,4})\b|\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b/g,
  )];
  for (const m of matches) {
    const year = m[3] ? parseInt(m[3].length === 2 ? `19${m[3]}` : m[3], 10) : parseInt(m[4], 10);
    if (year >= 1900 && year <= 2026) return m[0];
  }
  return matches[0]?.[0] ?? null;
}

export function extractByType(
  text: string,
  wantedFields: string[],
  docType: DocumentType,
): Record<string, string> {
  switch (docType) {
    case "cc": return extractCC(text, wantedFields).fields;
    case "ce": return extractCE(text, wantedFields).fields;
    case "ti": return extractTI(text, wantedFields).fields;
    case "passport": return extractPassport(text, wantedFields).fields;
    case "auto":
    default: {
      const results = [
        extractCC(text, wantedFields),
        extractPassport(text, wantedFields),
        extractCE(text, wantedFields),
        extractTI(text, wantedFields),
      ];
      results.sort((a, b) => b.matchCount - a.matchCount);
      return results[0].fields;
    }
  }
}

// ─── Validación post-OCR (no bloqueante) ────────────────────────────────────
export function validatePostOcr(data: Record<string, string>): Record<string, boolean> {
  const suspicious: Record<string, boolean> = {};
  if (data.numero && !/^[A-Z0-9]{6,12}$/.test(data.numero)) suspicious.numero = true;
  if (data.nombre && (data.nombre.length < 5 || !/\s/.test(data.nombre))) suspicious.nombre = true;
  if (data.fechaNacimiento) {
    const yearMatch = data.fechaNacimiento.match(/(\d{4})/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1], 10);
      if (y < 1900 || y > 2026) suspicious.fechaNacimiento = true;
    } else {
      suspicious.fechaNacimiento = true;
    }
  }
  return suspicious;
}
