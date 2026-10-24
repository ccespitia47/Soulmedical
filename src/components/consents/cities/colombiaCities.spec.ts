import { describe, it, expect } from "vitest";
import { CIUDADES_COLOMBIA } from "./colombiaCities";

describe("CIUDADES_COLOMBIA", () => {
  it("toda entrada tiene municipio y departamento", () => {
    for (const c of CIUDADES_COLOMBIA) expect(c).toMatch(/^[^,]+, [^,]+$/);
  });
  it("incluye las 32 capitales de departamento y Bogotá", () => {
    expect(CIUDADES_COLOMBIA).toContain("Medellín, Antioquia");
    expect(CIUDADES_COLOMBIA).toContain("Bogotá D.C., Bogotá D.C.");
    expect(CIUDADES_COLOMBIA.length).toBeGreaterThanOrEqual(33);
  });
  it("no tiene duplicados y está ordenada", () => {
    expect(new Set(CIUDADES_COLOMBIA).size).toBe(CIUDADES_COLOMBIA.length);
    expect([...CIUDADES_COLOMBIA].sort((a, b) => a.localeCompare(b, "es"))).toEqual(CIUDADES_COLOMBIA);
  });
});
