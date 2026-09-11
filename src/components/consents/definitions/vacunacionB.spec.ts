import { describe, it, expect } from "vitest";
import { vacunacionBDefinition } from "./vacunacionB";

describe("definición Vacunación‑B", () => {
  it("es multi-entidad y de tipo vacunacion_b", () => {
    const def = vacunacionBDefinition("soul");
    expect(def.meta.tipo).toBe("vacunacion_b");
    expect(def.meta.entidad).toBe("SOUL");
    expect(def.sections.some((s) => s.kind === "signatures")).toBe(true);
  });
});
