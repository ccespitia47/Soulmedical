import { describe, it, expect } from "vitest";
import { tuberculinaDefinition } from "./tuberculina";
import { venopuncionDefinition } from "./venopuncion";

describe("definiciones Tuberculina / Venopunción", () => {
  it("Tuberculina conserva identidad + preguntas clínicas + firma", () => {
    expect(tuberculinaDefinition.meta.tipo).toBe("tuberculina");
    const kinds = tuberculinaDefinition.sections.map((s) => s.kind);
    expect(kinds).toContain("fields");
    expect(kinds).toContain("signatures");
    // al menos una sección de preguntas (tristate) o campos clínicos adicionales
    expect(tuberculinaDefinition.sections.length).toBeGreaterThanOrEqual(3);
  });
  it("Venopunción incluye datos de acompañante y profesional", () => {
    const allIds = venopuncionDefinition.sections.flatMap((s: any) => (s.fields ?? []).map((f: any) => f.id));
    expect(allIds.some((id: string) => /acompan/i.test(id))).toBe(true);
    expect(allIds.some((id: string) => /profesional/i.test(id))).toBe(true);
  });
});
