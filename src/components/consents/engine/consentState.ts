// Lógica genérica de estado para el motor de consentimientos config-driven:
// validación de requeridos (`collectMissing`), aplanado de respuestas
// (`flattenConsent`) y construcción del payload de creación (`buildCreatePayload`).

import type { ConsentRecordDto, CreateConsentPayload } from "../../../services/api";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

/** Ids de identidad: se mapean a columnas propias del payload, no a `respuestas`. */
const IDENTITY_IDS = [
  "nombres",
  "apellidos",
  "tipoDoc",
  "numDoc",
  "ciudad",
  "profesional",
] as const;

/** Recorre las secciones y devuelve las etiquetas de lo que falta por completar. */
export function collectMissing(def: ConsentDefinition, state: ConsentState): string[] {
  const missing: string[] = [];

  for (const section of def.sections) {
    switch (section.kind) {
      case "fields":
        for (const f of section.fields) {
          if (f.required && !(state.values[f.id] ?? "").trim()) missing.push(f.label);
        }
        break;
      case "tristate":
        for (const q of section.questions) {
          if (q.required && !(state.values[q.id] ?? "").trim()) missing.push(q.text);
        }
        break;
      case "legal":
        if (!state.accepted) missing.push("Aceptar el consentimiento informado");
        break;
      case "signatures":
        if (!state.firma) missing.push(section.firmaPaciente.label);
        if (section.firmaResponsable && !state.firmaResp) {
          missing.push(section.firmaResponsable.label);
        }
        break;
      default:
        break;
    }
  }

  return missing;
}

/** Aplana valores + firmas + aceptación + foto en un único mapa id -> valor. */
export function flattenConsent(def: ConsentDefinition, state: ConsentState): Record<string, string> {
  const flat: Record<string, string> = { ...state.values };

  for (const section of def.sections) {
    switch (section.kind) {
      case "legal":
        flat[section.acceptId] = state.accepted ? "Sí" : "No";
        break;
      case "signatures":
        flat[section.firmaPaciente.id] = state.firma;
        if (section.firmaResponsable) flat[section.firmaResponsable.id] = state.firmaResp;
        break;
      case "photo":
        flat[section.photo.id] = state.foto;
        break;
      default:
        break;
    }
  }

  return flat;
}

/** Separa identidad (columnas propias) del resto (respuestas) para el POST /consents. */
export function buildCreatePayload(def: ConsentDefinition, state: ConsentState): CreateConsentPayload {
  const flat = flattenConsent(def, state);

  const excludeFromRespuestas = new Set<string>(IDENTITY_IDS);
  for (const section of def.sections) {
    if (section.kind === "signatures") {
      excludeFromRespuestas.add(section.firmaPaciente.id);
      if (section.firmaResponsable) excludeFromRespuestas.add(section.firmaResponsable.id);
    }
    if (section.kind === "photo") excludeFromRespuestas.add(section.photo.id);
  }

  const respuestas: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(flat)) {
    if (!excludeFromRespuestas.has(id)) respuestas[id] = value;
  }

  const values = state.values;

  return {
    tipo: def.meta.tipo,
    entidad: def.meta.entidad,
    nombres: values.nombres ?? "",
    apellidos: values.apellidos || undefined,
    tipoDoc: values.tipoDoc ?? "",
    numDoc: values.numDoc ?? "",
    ciudad: values.ciudad || undefined,
    profesional: values.profesional || undefined,
    respuestas,
    firmaPaciente: state.firma,
    firmaResponsable: state.firmaResp || undefined,
    foto: state.foto || undefined,
  };
}

/**
 * Reconstruye el `ConsentState` de un registro guardado, para reabrirlo en
 * `ConsentForm` en modo edición (Task 6). `respuestas` usa exactamente los
 * mismos ids que `state.values` (ver `buildCreatePayload`: solo excluye
 * identidad/firmas/foto), así que basta con fusionarlas con la identidad.
 * Las firmas/foto llegan aparte como data URLs (vienen de GridFS vía
 * `GET /consents/:id/pdf`, no del registro mismo).
 */
export function buildEditState(
  def: ConsentDefinition,
  record: ConsentRecordDto,
  dataUrls: {
    firmaPacienteDataUrl: string | null;
    firmaResponsableDataUrl: string | null;
    fotoDataUrl: string | null;
  },
): ConsentState {
  const values: Record<string, string> = {
    nombres: record.nombres ?? "",
    apellidos: record.apellidos ?? "",
    tipoDoc: record.tipoDoc ?? "",
    numDoc: record.numDoc ?? "",
    ciudad: record.ciudad ?? "",
    profesional: record.profesional ?? "",
  };
  for (const [id, value] of Object.entries(record.respuestas ?? {})) {
    values[id] = typeof value === "string" ? value : JSON.stringify(value);
  }

  let accepted = false;
  for (const section of def.sections) {
    if (section.kind === "legal") accepted = values[section.acceptId] === "Sí";
  }

  return {
    values,
    firma: dataUrls.firmaPacienteDataUrl ?? "",
    firmaResp: dataUrls.firmaResponsableDataUrl ?? "",
    foto: dataUrls.fotoDataUrl ?? "",
    accepted,
  };
}
