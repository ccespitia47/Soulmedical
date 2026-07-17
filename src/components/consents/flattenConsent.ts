import {
  ACCEPT_FIELD_ID,
  SIGNATURE_FIELD_ID,
  SIGNATURE_RESP_FIELD_ID,
  type EntityConfig,
} from "./config";

export type ConsentState = {
  values: Record<string, string>;
  firma: string;
  firmaResp: string;
  accepted: boolean;
};

/** Campos generales obligatorios (para validación). */
function generalRequired(config: EntityConfig) {
  return config.datosGenerales.filter((f) => f.required);
}

export function collectMissing(config: EntityConfig, state: ConsentState): string[] {
  const missing: string[] = [];
  for (const f of generalRequired(config)) {
    if (!(state.values[f.id] ?? "").trim()) missing.push(f.label);
  }
  // Preguntas marcadas required (por defecto ninguna).
  for (const q of [...config.seccionB, ...config.virusVivos]) {
    if (q.required && !(state.values[q.id] ?? "").trim()) missing.push(q.text);
  }
  if (!state.accepted) missing.push("Aceptar el consentimiento informado");
  if (!state.firma) missing.push(config.firmas.firmaPaciente.label);
  if (!state.firmaResp) missing.push(config.firmas.firmaResponsable.label);
  return missing;
}

export function flattenConsent(config: EntityConfig, state: ConsentState): Record<string, string> {
  return {
    ...state.values,
    [SIGNATURE_FIELD_ID]: state.firma,
    [SIGNATURE_RESP_FIELD_ID]: state.firmaResp,
    [ACCEPT_FIELD_ID]: state.accepted ? "Sí" : "No",
  };
}

/** Datos legibles (sin firmas) para el cuerpo del correo. */
export function readableSummary(
  config: EntityConfig,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of config.datosGenerales) out[f.id] = values[f.id] ?? "";
  return out;
}
