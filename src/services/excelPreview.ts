const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

export type ExcelPreviewResult = {
  html: string;
  css: string;
  error?: string;
};

export type FilledPreviewParams = {
  excelBase64: string;
  mappings: Array<{ coord: string; placeholder: string }>;
  values: Record<string, string>;
  customLogoBase64?: string;
};

/**
 * Envía el .xlsx (como base64 o File) al backend y recibe el HTML fiel
 * generado por LibreOffice, con `data-coord="A1"` inyectado en cada <td>
 * para que el mapper pueda capturar la celda al hacer click.
 */
export async function fetchExcelPreview(excelBase64: string): Promise<ExcelPreviewResult> {
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("file", base64ToBlob(excelBase64), "input.xlsx");

  try {
    const res = await fetch(`${API_URL}/forms/excel/preview-html`, {
      method: "POST",
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        html: "",
        css: "",
        error: body.message || `Error ${res.status}`,
      };
    }
    return (await res.json()) as ExcelPreviewResult;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { html: "", css: "", error: `No se pudo conectar: ${detail}` };
  }
}

/**
 * Preview con placeholders rellenados y logo custom. Devuelve el HTML
 * exactamente igual al PDF que se generará.
 */
export async function fetchFilledPreview(
  params: FilledPreviewParams,
): Promise<ExcelPreviewResult> {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/forms/excel/preview-filled`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        html: "",
        css: "",
        error: body.message || `Error ${res.status}`,
      };
    }
    return (await res.json()) as ExcelPreviewResult;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { html: "", css: "", error: `No se pudo conectar: ${detail}` };
  }
}

/**
 * Edita el texto de celdas del XLSX. `edits` mapea coord → texto nuevo
 * (string vacío ⇒ blanquear la celda). El backend aplica los cambios con
 * exceljs y devuelve el nuevo base64 + HTML/CSS fresco para refrescar
 * el preview del mapper sin re-correr LibreOffice de principio a fin.
 */
export async function editExcelCells(
  excelBase64: string,
  edits: Record<string, string>,
): Promise<{ excelBase64?: string; html?: string; css?: string; error?: string }> {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/forms/excel/edit-cells`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ excelBase64, edits }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.message || `Error ${res.status}` };
    }
    return (await res.json()) as { excelBase64: string; html: string; css: string };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo conectar: ${detail}` };
  }
}

/**
 * Renderiza y descarga el PDF final. Devuelve el Blob o un error.
 */
export async function fetchRenderedPdf(
  params: FilledPreviewParams & { filename?: string },
): Promise<{ blob?: Blob; error?: string }> {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_URL}/forms/excel/render-pdf`, {
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

function base64ToBlob(input: string): Blob {
  const raw = input.includes(",") ? input.split(",")[1] : input;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob(
    [bytes],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
}
