import { describe, it, expect } from "vitest";
import { vacunacionDefinition } from "./vacunacion";
import { getEntityConfig } from "../config";
import type { FieldsSection, SignaturesSection } from "../engine/consentDefinition";

// Caracterización por COBERTURA (no por igualdad byte a byte de ids): la
// definición debe conservar el mismo número y conjunto de ETIQUETAS de los
// datos generales, representar la identidad con ids canónicos, exponer
// `meta.entidad`/`meta.codigo`/`meta.tipo` correctos y traer firmas.
describe("vacunacionDefinition (caracterización)", () => {
  it("cubre todos los datos generales del EntityConfig SOUL (mismo número y etiquetas)", () => {
    const cfg = getEntityConfig("soul");
    const def = vacunacionDefinition("soul");
    const grales = def.sections.find(
      (s): s is FieldsSection => s.kind === "fields" && s.id === "grales",
    )!;
    expect(grales).toBeTruthy();
    expect(grales.fields).toHaveLength(cfg.datosGenerales.length);
    expect(grales.fields.map((f) => f.label).sort()).toEqual(
      cfg.datosGenerales.map((f) => f.label).sort(),
    );
    // La identidad se representa con ids canónicos que espera buildCreatePayload.
    const ids = grales.fields.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["nombres", "tipoDoc", "numDoc", "ciudad"]));
    expect(def.meta.entidad).toBe("SOUL");
    expect(def.meta.codigo).toBe(cfg.meta.codigo);
    expect(def.meta.tipo).toBe("vacunacion");
  });

  it("incluye una sección de firmas con firma de paciente y responsable", () => {
    const def = vacunacionDefinition("soul");
    const firmas = def.sections.find(
      (s): s is SignaturesSection => s.kind === "signatures",
    )!;
    expect(firmas.firmaPaciente).toBeTruthy();
    expect(firmas.firmaResponsable).toBeTruthy();
  });

  it("mapea SAI conservando el conteo de datos generales y sin campo de tétanos", () => {
    const cfg = getEntityConfig("sai");
    const def = vacunacionDefinition("sai");
    const grales = def.sections.find(
      (s): s is FieldsSection => s.kind === "fields" && s.id === "grales",
    )!;
    expect(grales.fields).toHaveLength(cfg.datosGenerales.length);
    expect(def.meta.entidad).toBe("SAI");
    // SAI no tiene pregunta de tétanos: no debe existir la tarjeta de tétanos.
    expect(def.sections.find((s) => s.id === "seccionA-tetanos")).toBeUndefined();
  });
});
