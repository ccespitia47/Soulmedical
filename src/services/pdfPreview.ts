const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

export type PdfMappingDto = {
  placeholder: string;
  x: number;
  y: number;
  page: number;
  fontSize?: number;
};

export type FilledPdfParams = {
  pdfBase64: string;
  mappings: PdfMappingDto[];
  values: Record<string, string>;
};

export type PdfPreviewResult = {
  pdfBase64?: string;
  error?: string;
};

/**
 * Rellena el PDF con los mapeos + valores en backend (pdf-lib) y devuelve
 * el PDF resultante como data URI. El frontend lo muestra con react-pdf.
 */
export async function fetchFilledPdfPreview(
  params: FilledPdfParams,
): Promise<PdfPreviewResult> {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/forms/pdf/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.message || `Error ${res.status}` };
    }
    return (await res.json()) as PdfPreviewResult;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo conectar: ${detail}` };
  }
}

/**
 * Rellena y descarga el PDF como binario. Devuelve el Blob.
 */
export async function fetchRenderedPdfFile(
  params: FilledPdfParams & { filename?: string },
): Promise<{ blob?: Blob; error?: string }> {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/forms/pdf/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.message || `Error ${res.status}` };
    }
    return { blob: await res.blob() };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo conectar: ${detail}` };
  }
}
