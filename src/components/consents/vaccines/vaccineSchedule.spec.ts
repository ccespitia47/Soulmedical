import { describe, expect, it } from "vitest";
import { CATALOGO, calcularProxima, findEntry, siguienteDosisLabel } from "./vaccineSchedule";

describe("calcularProxima", () => {
  it("cuenta desde la dosis 1: Antirrábica POS da 0-3-7", () => {
    expect(calcularProxima(findEntry("ANTIRRABICA POS D1")!, "2026-01-01")).toBe("2026-01-04");
    expect(calcularProxima(findEntry("ANTIRRABICA POS D2")!, "2026-01-01")).toBe("2026-01-08");
  });

  it("la última fila de la vacuna no agenda nada", () => {
    expect(calcularProxima(findEntry("ANTIRRABICA POS D3")!, "2026-01-01")).toBe("");
    expect(calcularProxima(findEntry("HEPATITIS B D2")!, "2026-01-01")).toBe("");
  });

  it("las vacunas de una sola fila no agendan nada", () => {
    for (const label of ["DENGUE D1", "DPT-a D1", "HEPATITIS A D1", "HERPES ZOSTER D1",
                         "MENINGOCOCO B D1", "MENINGOCOCO AYW 135 D1", "NEUMOCOCO 23 D1",
                         "VARICELA D1", "ANTIRRABICA PRE D1"]) {
      expect(calcularProxima(findEntry(label)!, "2026-01-01")).toBe("");
    }
  });

  it("las de dosis única no agendan nada", () => {
    expect(calcularProxima(findEntry("INFLUENZA · dosis única")!, "2026-01-01")).toBe("");
  });

  it("sin fecha de dosis 1 no inventa una fecha", () => {
    expect(calcularProxima(findEntry("HEPATITIS B D1")!, "")).toBe("");
  });
});

describe("siguienteDosisLabel", () => {
  it("sugiere la dosis siguiente a la mayor registrada", () => {
    expect(siguienteDosisLabel("HEPATITIS B", ["1"])).toBe("HEPATITIS B D2");
  });
  it("sin registros sugiere la dosis 1", () => {
    expect(siguienteDosisLabel("TETANO", [])).toBe("TETANO D1");
  });
  it("devuelve null cuando ya se puso la última dosis del esquema", () => {
    expect(siguienteDosisLabel("HEPATITIS B", ["1", "2"])).toBeNull();
  });
  it("ignora la entrada de dosis única al contar dosis del esquema", () => {
    expect(siguienteDosisLabel("NEUMOCOCO 13", ["única"])).toBe("NEUMOCOCO 13 D1");
  });
});

describe("CATALOGO", () => {
  it("tiene 34 entradas de esquema y 8 de dosis única", () => {
    expect(CATALOGO.filter((e) => e.dosis !== "única")).toHaveLength(34);
    expect(CATALOGO.filter((e) => e.dosis === "única")).toHaveLength(8);
  });
});
