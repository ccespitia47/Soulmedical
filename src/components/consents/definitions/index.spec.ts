import { describe, it, expect } from "vitest";
import { CONSENT_TYPES, getDefinition } from "./index";

// Ruling del controlador (Plan 3, Task 2): las definiciones de tuberculina y
// venopunción se agregaron en Task 4; `vacunacion_b` en Task 5. Este registro
// ya resuelve los 6 tipos sin lanzar.
describe("definitions registry", () => {
  it("expone los 6 tipos en orden con etiqueta e icono", () => {
    expect(CONSENT_TYPES.map((t) => t.tipo)).toEqual([
      "vacunacion",
      "vacunacion_b",
      "tuberculina",
      "venopuncion",
      "vih",
      "infectologia",
    ]);
    expect(CONSENT_TYPES.every((t) => t.label && t.icon)).toBe(true);
  });

  it("getDefinition('vacunacion') devuelve una definición con meta.tipo vacunacion", () => {
    expect(getDefinition("vacunacion").meta.tipo).toBe("vacunacion");
  });

  it("getDefinition resuelve vih e infectologia (Task 3)", () => {
    expect(getDefinition("vih").meta.tipo).toBe("vih");
    expect(getDefinition("infectologia").meta.tipo).toBe("infectologia");
  });

  it("getDefinition resuelve tuberculina y venopuncion (Task 4)", () => {
    expect(getDefinition("tuberculina").meta.tipo).toBe("tuberculina");
    expect(getDefinition("venopuncion").meta.tipo).toBe("venopuncion");
  });

  it("getDefinition resuelve vacunacion_b, multi-entidad (Task 5)", () => {
    expect(getDefinition("vacunacion_b", "soul").meta.entidad).toBe("SOUL");
    expect(getDefinition("vacunacion_b", "sai").meta.tipo).toBe("vacunacion_b");
  });
});
