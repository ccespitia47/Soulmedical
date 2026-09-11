// Registro de tipos de consentimiento del módulo Consientify.
//
// Ruling del controlador (Plan 3, Task 2): las definiciones de tuberculina y
// venopunción se implementaron en Task 4; `vih` e `infectologia` en Task 3;
// `vacunacion_b` en Task 5. Los 6 tipos resuelven.

import { vacunacionDefinition } from "./vacunacion";
import { vacunacionBDefinition } from "./vacunacionB";
import { vihDefinition } from "./vih";
import { infectologiaDefinition } from "./infectologia";
import { tuberculinaDefinition } from "./tuberculina";
import { venopuncionDefinition } from "./venopuncion";
import type { ConsentDefinition } from "../engine/consentDefinition";
import type { EntityKey } from "../config";

export type ConsentTipo =
  | "vacunacion"
  | "vacunacion_b"
  | "tuberculina"
  | "venopuncion"
  | "vih"
  | "infectologia";

export type ConsentTypeMeta = {
  tipo: ConsentTipo;
  label: string;
  icon: string;
  /** true si el tipo distingue entre entidad SOUL/SAI (muestra el selector). */
  multiEntidad: boolean;
};

/** Orden de aparición en el selector de tarjetas. */
export const CONSENT_TYPES: ConsentTypeMeta[] = [
  { tipo: "vacunacion", label: "Vacunación", icon: "health", multiEntidad: true },
  { tipo: "vacunacion_b", label: "Vacunación (Esquema B)", icon: "checkSquare", multiEntidad: true },
  { tipo: "tuberculina", label: "Tuberculina", icon: "target", multiEntidad: false },
  { tipo: "venopuncion", label: "Venopunción", icon: "tag", multiEntidad: false },
  { tipo: "vih", label: "VIH", icon: "award", multiEntidad: false },
  { tipo: "infectologia", label: "Infectología", icon: "alert", multiEntidad: false },
];

/**
 * Resuelve la `ConsentDefinition` de un tipo. `entity` solo aplica a los
 * tipos multi-entidad (vacunación); el resto la ignora.
 */
export function getDefinition(tipo: ConsentTipo, entity: EntityKey = "soul"): ConsentDefinition {
  switch (tipo) {
    case "vacunacion":
      return vacunacionDefinition(entity);
    case "vih":
      return vihDefinition;
    case "infectologia":
      return infectologiaDefinition;
    case "tuberculina":
      return tuberculinaDefinition;
    case "venopuncion":
      return venopuncionDefinition;
    case "vacunacion_b":
      return vacunacionBDefinition(entity);
    default: {
      const _exhaustive: never = tipo;
      throw new Error("Consentimiento no implementado: " + String(_exhaustive));
    }
  }
}
