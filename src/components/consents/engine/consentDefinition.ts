// Tipos genéricos del motor de consentimientos (config-driven).
// Reutiliza los tipos de campo definidos en config/entityConfig.ts en vez de
// duplicarlos, para que toda config de entidad (SAI/SOUL/nuevas) comparta la
// misma forma de campo/pregunta/condición/columna.

import type {
  ConsentField,
  TriStateQ,
  ConditionsGroup,
  VaccineTableColumn,
} from "../config/entityConfig";

export type { ConsentField, TriStateQ, ConditionsGroup, VaccineTableColumn };

type SectionBase = { id: string; title?: string };

export type FieldsSection = SectionBase & {
  kind: "fields";
  fields: ConsentField[];
};

export type TristateSection = SectionBase & {
  kind: "tristate";
  questions: TriStateQ[];
};

export type ConditionsSection = SectionBase & {
  kind: "conditions";
  group: ConditionsGroup;
};

export type VaccineTableSection = SectionBase & {
  kind: "vaccineTable";
  columns: VaccineTableColumn[];
};

export type LegalSection = SectionBase & {
  kind: "legal";
  legalText: string;
  habeasData: string;
  /** Id de la casilla "Acepto el consentimiento informado". */
  acceptId: string;
};

export type SignaturesSection = SectionBase & {
  kind: "signatures";
  firmaPaciente: { id: string; label: string };
  firmaResponsable?: { id: string; label: string };
};

export type PhotoSection = SectionBase & {
  kind: "photo";
  photo: { id: string; label: string };
};

/** Sección discriminada por `kind`; cada variante trae su propio payload tipado. */
export type ConsentSection =
  | FieldsSection
  | TristateSection
  | ConditionsSection
  | VaccineTableSection
  | LegalSection
  | SignaturesSection
  | PhotoSection;

export type ConsentDefinition = {
  meta: {
    /** Slug del tipo de consentimiento (ej. "vih", "vacunacion"). */
    tipo: string;
    entidad?: "SAI" | "SOUL";
    titulo: string;
    entidadNombre: string;
    displayName: string;
    codigo: string;
    version: string;
    logo: string;
  };
  sections: ConsentSection[];
};

/** Estado mutable del formulario mientras el usuario lo completa. */
export type ConsentState = {
  values: Record<string, string>;
  firma: string;
  firmaResp: string;
  foto: string;
  accepted: boolean;
};
