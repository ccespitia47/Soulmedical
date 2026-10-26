const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

export type FormAssetResult = {
  fileId: string;
  url: string;
  error?: string;
};

/**
 * Sube una imagen del builder al bucket GridFS `form_assets`. Devuelve el
 * `fileId` (para borrado posterior) y la URL absoluta al endpoint público de
 * descarga. Requiere JWT + permiso `forms_edit`.
 */
export async function uploadFormAsset(file: File): Promise<FormAssetResult> {
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await fetch(`${API_URL}/forms/assets`, {
      method: "POST",
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        fileId: "",
        url: "",
        error: body.message || `Error ${res.status}`,
      };
    }

    const { fileId, url } = (await res.json()) as {
      fileId: string;
      url: string;
    };
    // El backend devuelve una URL relativa (/api/forms/assets/:id). La
    // absolutizamos con el host de la API para que sirva desde cualquier
    // origen (task share pages, PDFs renderizados server-side, etc.).
    const absolute = url.startsWith("http")
      ? url
      : `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}${url}`;
    return { fileId, url: absolute };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { fileId: "", url: "", error: `No se pudo subir: ${detail}` };
  }
}

/** Borra el asset del bucket. Silencioso si el id no existe. */
export async function deleteFormAsset(fileId: string): Promise<void> {
  if (!fileId) return;
  const token = localStorage.getItem("token");
  try {
    await fetch(`${API_URL}/forms/assets/${fileId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    /* best-effort */
  }
}
