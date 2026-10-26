/**
 * Convierte un Blob a base64 puro (sin el prefijo `data:...;base64,`).
 * Se usa para adjuntar archivos binarios al payload de email — Graph
 * espera solo los bytes en base64.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
