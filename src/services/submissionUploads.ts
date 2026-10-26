const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const API_URL = `${API_ROOT}/api`;

export type UploadResult = {
  fileId: string;
  contentType: string;
  size: number;
  error?: string;
};

/**
 * Sube un archivo binario al bucket GridFS `submission_files`. Endpoint
 * público (sin JWT) porque los formularios los responden usuarios finales
 * no autenticados. El widget guarda `gridfs:<fileId>` en su hidden input y
 * el backend lo detecta al recibir el submit (no re-procesa).
 */
export async function uploadSubmissionFile(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch(`${API_URL}/submissions/uploads`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        fileId: "",
        contentType: "",
        size: 0,
        error: body.message || `Error ${res.status}`,
      };
    }
    return (await res.json()) as UploadResult;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      fileId: "",
      contentType: "",
      size: 0,
      error: `No se pudo subir: ${detail}`,
    };
  }
}

/** Borra un archivo del bucket antes del submit. Best-effort. */
export async function deleteSubmissionFile(fileId: string): Promise<void> {
  if (!fileId) return;
  try {
    await fetch(`${API_URL}/submissions/uploads/${fileId}`, {
      method: "DELETE",
    });
  } catch {
    /* best-effort */
  }
}
