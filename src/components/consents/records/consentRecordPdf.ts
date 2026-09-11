// Reconstruye el HTML de PDF de un registro ya guardado (Task 6: vista de
// registros) a partir del payload de `GET /consents/:id/pdf` (registro +
// data URLs de firmas/foto desde GridFS), reutilizando `buildConsentPdf`
// (Task 1/motor) tal como lo hace el flujo de creación en `useConsentSubmission`.

import { getConsentPdfPayloadApi, type ConsentRecordDto } from "../../../services/api";
import { getDefinition, type ConsentTipo } from "../definitions";
import { buildConsentPdf } from "../engine/buildConsentPdf";
import type { ConsentDefinition } from "../engine/consentDefinition";
import type { EntityKey } from "../config";

function entityKeyOf(record: ConsentRecordDto): EntityKey {
  return record.entidad === "SAI" ? "sai" : "soul";
}

/** Aplana identidad + `respuestas` + data URLs de firma/foto al mismo mapa
 *  que consume `buildConsentPdf`. Resuelve los ids de firma/foto recorriendo
 *  `def.sections` (varían por tipo, ver `entityConfig.ts`) en vez de asumir
 *  un id fijo. */
function flattenRecord(
  def: ConsentDefinition,
  record: ConsentRecordDto,
  dataUrls: {
    firmaPacienteDataUrl: string | null;
    firmaResponsableDataUrl: string | null;
    fotoDataUrl: string | null;
  },
): Record<string, string> {
  const flat: Record<string, string> = {
    nombres: record.nombres ?? "",
    apellidos: record.apellidos ?? "",
    tipoDoc: record.tipoDoc ?? "",
    numDoc: record.numDoc ?? "",
    ciudad: record.ciudad ?? "",
    profesional: record.profesional ?? "",
  };
  for (const [id, value] of Object.entries(record.respuestas ?? {})) {
    flat[id] = typeof value === "string" ? value : JSON.stringify(value);
  }
  for (const section of def.sections) {
    if (section.kind === "signatures") {
      flat[section.firmaPaciente.id] = dataUrls.firmaPacienteDataUrl ?? "";
      if (section.firmaResponsable) flat[section.firmaResponsable.id] = dataUrls.firmaResponsableDataUrl ?? "";
    }
    if (section.kind === "photo") flat[section.photo.id] = dataUrls.fotoDataUrl ?? "";
  }
  return flat;
}

/** Descarga el payload de un registro guardado y arma el HTML de su PDF,
 *  listo para previsualizar (`ver`) o convertir a PDF (`descargar`). */
export async function buildRecordPdfHtml(record: ConsentRecordDto): Promise<string> {
  const { data, error } = await getConsentPdfPayloadApi(record.id);
  if (error || !data) throw new Error(error ?? "No se pudo obtener el consentimiento");
  const def = getDefinition(record.tipo as ConsentTipo, entityKeyOf(record));
  const flat = flattenRecord(def, data.record ?? record, data);
  return buildConsentPdf(def, flat);
}

/** Decodifica un PDF en base64 (de `htmlToPdfBase64`) y dispara su descarga
 *  en el navegador con el nombre dado. */
export function triggerPdfDownload(base64: string, filename: string): void {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
