import { describe, expect, it } from "vitest";
import { CATALOGO, addIntervalo, calcularProxima, fechaAIso, findEntry, isoADmy, nombreVacuna, parseDosis, siguienteDosisLabel } from "./vaccineSchedule";

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

describe("addIntervalo", () => {
  it("suma días", () => {
    expect(addIntervalo("2026-01-01", { cantidad: 14, unidad: "dias" })).toBe("2026-01-15");
  });
  it("suma meses (TETANO D2 → +5 meses)", () => {
    expect(addIntervalo("2026-01-01", findEntry("TETANO D2")!.intervalo!)).toBe("2026-06-01");
  });
  it("suma años (DPT-a → +10 años, NEUMOCOCO 23 → +5 años)", () => {
    expect(addIntervalo("2026-01-01", findEntry("DPT-a D1")!.intervalo!)).toBe("2036-01-01");
    expect(addIntervalo("2026-01-01", findEntry("NEUMOCOCO 23 D1")!.intervalo!)).toBe("2031-01-01");
  });
  it("recorta al fin de mes: 31-ene + 1 mes", () => {
    expect(addIntervalo("2026-01-31", { cantidad: 1, unidad: "meses" })).toBe("2026-02-28");
  });
  it("recorta al fin de mes en año bisiesto", () => {
    expect(addIntervalo("2024-01-31", { cantidad: 1, unidad: "meses" })).toBe("2024-02-29");
  });
  it("cruza de año: diciembre + 2 meses", () => {
    expect(addIntervalo("2026-12-15", { cantidad: 2, unidad: "meses" })).toBe("2027-02-15");
    expect(addIntervalo("2026-12-31", { cantidad: 2, unidad: "meses" })).toBe("2027-02-28");
  });
});

describe("calcularProxima con intervalos en meses", () => {
  it("usa la fecha de la dosis 1 como base para una dosis N>1 (TETANO D2 → +5 meses)", () => {
    expect(calcularProxima(findEntry("TETANO D2")!, "2026-01-01")).toBe("2026-06-01");
  });
  it("dosis 1 en meses (HEPATITIS B D1 → +1 mes)", () => {
    expect(calcularProxima(findEntry("HEPATITIS B D1")!, "2026-01-01")).toBe("2026-02-01");
  });
  it("dosis N>1 en años (TETANO D3 → +1 año desde la dosis 1)", () => {
    expect(calcularProxima(findEntry("TETANO D3")!, "2026-01-01")).toBe("2027-01-01");
  });
});

// Tabla clínica literal del spec §2 (vacuna, dosis, cantidad, unidad). Independiente
// del código: cualquier transcripción alterada en el catálogo rompe una fila concreta.
const TABLA_SPEC: Array<[string, string, number, "dias" | "meses" | "anios"]> = [
  ["ANTIRRABICA POS", "1", 3, "dias"],
  ["ANTIRRABICA POS", "2", 7, "dias"],
  ["ANTIRRABICA POS", "3", 14, "dias"],
  ["ANTIRRABICA PRE", "1", 7, "dias"],
  ["DENGUE", "1", 3, "meses"],
  ["DPT-a", "1", 10, "anios"],
  ["DPT-a + POLIO", "1", 2, "meses"],
  ["DPT-a + POLIO", "2", 6, "meses"],
  ["HEPATITIS A", "1", 6, "meses"],
  ["HEPATITIS A + B", "1", 1, "meses"],
  ["HEPATITIS A + B", "2", 5, "meses"],
  ["HEPATITIS B", "1", 1, "meses"],
  ["HEPATITIS B", "2", 5, "meses"],
  ["HERPES ZOSTER", "1", 2, "meses"],
  ["HEXAVALENTE", "1", 2, "meses"],
  ["HEXAVALENTE", "2", 4, "meses"],
  ["MENINGOCOCO AYW 135", "1", 2, "meses"],
  ["MENINGOCOCO B", "1", 2, "meses"],
  ["NEUMOCOCO 13", "1", 2, "meses"],
  ["NEUMOCOCO 13", "2", 4, "meses"],
  ["NEUMOCOCO 15", "1", 2, "meses"],
  ["NEUMOCOCO 15", "2", 4, "meses"],
  ["NEUMOCOCO 23", "1", 5, "anios"],
  ["PENTAVALENTE", "1", 2, "meses"],
  ["PENTAVALENTE", "2", 4, "meses"],
  ["ROTAVIRUS", "1", 2, "meses"],
  ["ROTAVIRUS", "2", 1, "meses"],
  ["TETANO", "1", 1, "meses"],
  ["TETANO", "2", 5, "meses"],
  ["TETANO", "3", 1, "anios"],
  ["TETANO", "4", 1, "anios"],
  ["VARICELA", "1", 2, "meses"],
  ["VPH", "1", 2, "meses"],
  ["VPH", "2", 4, "meses"],
];

describe("CATALOGO fijado contra la tabla del spec", () => {
  it("la tabla de referencia tiene 34 filas", () => {
    expect(TABLA_SPEC).toHaveLength(34);
  });

  it.each(TABLA_SPEC)("%s D%s → %i %s", (vacuna, dosis, cantidad, unidad) => {
    const e = findEntry(`${vacuna} D${dosis}`);
    expect(e, `falta ${vacuna} D${dosis}`).toBeDefined();
    expect(e!.vacuna).toBe(vacuna);
    expect(e!.dosis).toBe(dosis);
    expect(e!.intervalo).toEqual({ cantidad, unidad });
  });

  it("esUltima solo en la dosis mayor de cada vacuna", () => {
    const max = new Map<string, number>();
    for (const [v, d] of TABLA_SPEC) max.set(v, Math.max(max.get(v) ?? 0, Number(d)));
    for (const [v, d] of TABLA_SPEC) {
      expect(findEntry(`${v} D${d}`)!.esUltima, `${v} D${d}`).toBe(Number(d) === max.get(v));
    }
  });

  it("las 8 de dosis única son exactamente las del spec, sin intervalo y esUltima", () => {
    const unicas = CATALOGO.filter((e) => e.dosis === "única").map((e) => e.vacuna).sort();
    expect(unicas).toEqual(
      ["FIEBRE AMARILLA", "FIEBRE TIFOIDEA", "HEXAVALENTE", "INFLUENZA", "MENINGOCOCO",
       "NEUMOCOCO 13", "PENTAVALENTE", "TRIPLE VIRAL"].sort(),
    );
    for (const e of CATALOGO.filter((x) => x.dosis === "única")) {
      expect(e.intervalo).toBeNull();
      expect(e.esUltima).toBe(true);
    }
  });
});

describe("nombreVacuna", () => {
  it("quita el sufijo de dosis del esquema", () => {
    expect(nombreVacuna("HEPATITIS B D1")).toBe("HEPATITIS B");
    expect(nombreVacuna("TETANO D12")).toBe("TETANO");
    expect(nombreVacuna("DPT-a + POLIO D2")).toBe("DPT-a + POLIO");
  });
  it("quita el sufijo de dosis única", () => {
    expect(nombreVacuna("INFLUENZA · dosis única")).toBe("INFLUENZA");
  });
  it("deja intacto el texto libre o ya normalizado", () => {
    expect(nombreVacuna("Hepatitis B")).toBe("Hepatitis B");
    expect(nombreVacuna("")).toBe("");
    expect(nombreVacuna("MENINGOCOCO AYW 135")).toBe("MENINGOCOCO AYW 135");
  });
  it("devuelve el nombre de vacuna de cada entrada del catálogo", () => {
    for (const e of CATALOGO) expect(nombreVacuna(e.label)).toBe(e.vacuna);
  });
});

describe("calcularProxima valida el formato de la base", () => {
  it.each(["15/03/2024", "2026-1-5", "ayer", "2026-03-01T10:00"])("base %s no es ISO → vacío", (base) => {
    expect(calcularProxima(findEntry("HEPATITIS B D1")!, base)).toBe("");
  });
});

describe("parseDosis", () => {
  it.each([["1", 1], ["1ª", 1], [" 2 ", 2], ["3º", 3], ["1a", 1]])("%s → %i", (txt, n) => {
    expect(parseDosis(txt)).toBe(n);
  });
  it.each(["1/2", "1.5", "1 refuerzo", "única", "", "abc"])("%s no se reconoce → null", (txt) => {
    expect(parseDosis(txt)).toBeNull();
  });
});

describe("siguienteDosisLabel con dosis en texto", () => {
  it("entiende 1ª y no se deja engañar por 1/2", () => {
    expect(siguienteDosisLabel("HEPATITIS B", ["1ª"])).toBe("HEPATITIS B D2");
    expect(siguienteDosisLabel("HEPATITIS B", ["1/2"])).toBe("HEPATITIS B D1");
  });
});

describe("las vacunas parecidas no se confunden", () => {
  it.each([
    ["NEUMOCOCO 13 D1", "NEUMOCOCO 13"],
    ["NEUMOCOCO 15 D1", "NEUMOCOCO 15"],
    ["NEUMOCOCO 23 D1", "NEUMOCOCO 23"],
    ["HEPATITIS A D1", "HEPATITIS A"],
    ["HEPATITIS A + B D1", "HEPATITIS A + B"],
    ["DPT-a D1", "DPT-a"],
    ["DPT-a + POLIO D1", "DPT-a + POLIO"],
    ["NEUMOCOCO 13 · dosis única", "NEUMOCOCO 13"],
  ])("%s → %s", (label, vacuna) => {
    expect(nombreVacuna(label)).toBe(vacuna);
    expect(findEntry(label)!.vacuna).toBe(vacuna);
  });
  it("siguienteDosisLabel distingue por nombre exacto", () => {
    expect(siguienteDosisLabel("HEPATITIS A", ["1"])).toBeNull();
    expect(siguienteDosisLabel("HEPATITIS A + B", ["1"])).toBe("HEPATITIS A + B D2");
    expect(siguienteDosisLabel("NEUMOCOCO 23", ["1"])).toBeNull();
  });
});

describe("formato de fechas dd/mm/aaaa", () => {
  it("isoADmy convierte ISO válido y deja vacío lo demás", () => {
    expect(isoADmy("2026-04-01")).toBe("01/04/2026");
    expect(isoADmy("")).toBe("");
    expect(isoADmy("ayer")).toBe("");
    expect(isoADmy("01/04/2026")).toBe("");
  });
  it("fechaAIso entiende ISO y dd/mm/aaaa (y descarta fechas imposibles o texto libre)", () => {
    expect(fechaAIso("2026-04-01")).toBe("2026-04-01");
    expect(fechaAIso("01/04/2026")).toBe("2026-04-01");
    expect(fechaAIso(" 1/4/2026 ")).toBe("2026-04-01");
    expect(fechaAIso("31/02/2026")).toBe("");
    expect(fechaAIso("pendiente")).toBe("");
    expect(fechaAIso("")).toBe("");
  });
  it("ida y vuelta", () => {
    expect(fechaAIso(isoADmy("2026-12-31"))).toBe("2026-12-31");
  });
});
