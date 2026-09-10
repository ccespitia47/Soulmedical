// Deriva un `ConsentDefinition` (motor config-driven) del `EntityConfig` de
// Vacunación (SOUL/SAI). No cambia el contenido: reordena la misma información
// en las secciones tipadas del motor, conservando TODOS los campos y preguntas.
//
// Ruling de identidad (Task 7): los ids de identidad se mapean a los ids
// CANÓNICOS que espera `buildCreatePayload` (`nombres`/`tipoDoc`/`numDoc`/
// `ciudad`), manteniendo las etiquetas originales del formulario. El resto de
// campos conserva su id (fluyen a `respuestas`).

import { getEntityConfig, ACCEPT_FIELD_ID, type EntityKey } from "../config";
import type {
  ConsentDefinition,
  ConsentSection,
  ConsentField,
} from "../engine/consentDefinition";

/** pacienteNombre→nombres, pacienteTipoDoc→tipoDoc, pacienteNumDoc→numDoc.
 *  `ciudad` ya es canónico y se conserva tal cual. */
const IDENTITY_ID_MAP: Record<string, string> = {
  pacienteNombre: "nombres",
  pacienteTipoDoc: "tipoDoc",
  pacienteNumDoc: "numDoc",
};

/** Remapea el id a canónico si aplica; conserva la etiqueta intacta. */
function mapGeneralField(f: ConsentField): ConsentField {
  const id = IDENTITY_ID_MAP[f.id] ?? f.id;
  return id === f.id ? f : { ...f, id };
}

const SECCION_A_TITLE = "Sección A · Historial de vacunas";

export function vacunacionDefinition(entity: EntityKey): ConsentDefinition {
  const cfg = getEntityConfig(entity);
  const a = cfg.seccionA;

  const sections: ConsentSection[] = [];

  // 1. Datos generales (identidad → ids canónicos, etiquetas intactas).
  sections.push({
    id: "grales",
    kind: "fields",
    title: "Datos generales",
    fields: cfg.datosGenerales.map(mapGeneralField),
  });

  // 2. Sección A · Historial de vacunas. El motor no tiene una sección mixta,
  //    así que se descompone en sus primitivas conservando el orden visual:
  //    tétanos (solo SOUL) → condiciones → antineumocócica → fecha → herpes.
  if (a.tetanosAnios) {
    sections.push({
      id: "seccionA-tetanos",
      kind: "fields",
      title: SECCION_A_TITLE,
      fields: [a.tetanosAnios],
    });
  }
  sections.push({
    id: "condiciones",
    kind: "conditions",
    // El título de la Sección A va en su primera tarjeta: la de tétanos si
    // existe (SOUL), o la de condiciones si no (SAI).
    title: a.tetanosAnios ? undefined : SECCION_A_TITLE,
    group: a.condiciones,
  });
  sections.push({
    id: "seccionA-antineumococica",
    kind: "tristate",
    questions: [a.antineumococica],
  });
  sections.push({
    id: "seccionA-antineumococicaFecha",
    kind: "fields",
    fields: [a.antineumococicaFecha],
  });
  sections.push({
    id: "seccionA-herpesZoster",
    kind: "tristate",
    questions: [a.herpesZoster],
  });

  // 3. Sección B · Cuestionario sobre salud (preguntas 1-6).
  sections.push({
    id: "seccionB",
    kind: "tristate",
    title: "Sección B · Cuestionario sobre salud",
    questions: cfg.seccionB,
  });

  // 4. Vacunas de virus vivos (preguntas 7-13).
  sections.push({
    id: "virusVivos",
    kind: "tristate",
    title: "Vacunas de virus vivos · Preguntas adicionales",
    questions: cfg.virusVivos,
  });

  // 5. Sección C · Tabla de vacunas. El id "seccionC" es el que usan
  //    `flattenConsent`/`buildConsentPdf` para leer el JSON de filas.
  sections.push({
    id: "seccionC",
    kind: "vaccineTable",
    title: "Sección C · Datos de la(s) vacuna(s)",
    columns: cfg.seccionC.columns,
  });

  // 6. Consentimiento informado + Habeas Data. El motor no tiene una primitiva
  //    para "efectos adversos" (solo SAI); para no perder ese contenido se
  //    antepone al texto legal como párrafos con su encabezado.
  const legalText =
    cfg.efectosAdversos && cfg.efectosAdversos.length
      ? ["Posibles efectos adversos esperados:", ...cfg.efectosAdversos, cfg.legalText].join(
          "\n\n",
        )
      : cfg.legalText;
  sections.push({
    id: "legal",
    kind: "legal",
    title: "Consentimiento informado",
    legalText,
    habeasData: cfg.habeasData,
    acceptId: ACCEPT_FIELD_ID,
  });

  // 7. Firmas (paciente + responsable de vacunación).
  sections.push({
    id: "firmas",
    kind: "signatures",
    firmaPaciente: cfg.firmas.firmaPaciente,
    firmaResponsable: cfg.firmas.firmaResponsable,
  });

  return {
    meta: {
      tipo: "vacunacion",
      entidad: cfg.meta.displayName as "SOUL" | "SAI",
      titulo: "Consentimiento Informado para Vacunación",
      entidadNombre: cfg.meta.entidadNombre,
      displayName: cfg.meta.displayName,
      codigo: cfg.meta.codigo,
      version: cfg.meta.version,
      logo: cfg.meta.logo,
    },
    sections,
  };
}
