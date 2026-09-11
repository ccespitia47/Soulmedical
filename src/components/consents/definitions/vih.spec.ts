import { describe, it, expect } from "vitest";
import { vihDefinition } from "./vih";
import { infectologiaDefinition } from "./infectologia";

describe("definiciones VIH / Infectología", () => {
  it("VIH tiene identidad + legal + firma, sin entidad", () => {
    expect(vihDefinition.meta.tipo).toBe("vih");
    expect(vihDefinition.meta.entidad).toBeUndefined();
    const kinds = vihDefinition.sections.map((s) => s.kind);
    expect(kinds).toContain("fields");
    expect(kinds).toContain("legal");
    expect(kinds).toContain("signatures");
    const ids = (vihDefinition.sections.find((s) => s.kind === "fields") as any).fields.map((f: any) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["nombres", "apellidos", "tipoDoc", "numDoc"]));
  });
  it("Infectología incluye una sección de foto", () => {
    expect(infectologiaDefinition.sections.some((s) => s.kind === "photo")).toBe(true);
  });
});
