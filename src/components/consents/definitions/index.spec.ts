import { describe, it, expect } from "vitest";
import { CONSENT_TYPES, getDefinition } from "./index";

// Ruling del controlador (Plan 3, Task 2): las definiciones de tuberculina,
// venopunción, vih e infectología llegan en Tasks 3-5. Este registro solo
// resuelve `vacunacion` por ahora; el resto lanza un error claro hasta que
// existan sus definiciones.
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

  it("getDefinition lanza un error claro para tipos aún no implementados", () => {
    expect(() => getDefinition("vih")).toThrow(/vih/);
    expect(() => getDefinition("tuberculina")).toThrow(/no implementado/);
  });
});
