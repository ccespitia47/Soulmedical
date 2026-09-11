import { describe, it, expect } from "vitest";
import { collectMissing, flattenConsent, buildCreatePayload } from "./consentState";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "VIH", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C1", version: "1", logo: "" },
  sections: [
    { id: "grales", kind: "fields", title: "Datos", fields: [
      { id: "nombres", label: "Nombres", type: "text", required: true },
      { id: "apellidos", label: "Apellidos", type: "text", required: true },
      { id: "tipoDoc", label: "Tipo doc", type: "text", required: true },
      { id: "numDoc", label: "N° doc", type: "text", required: true },
      { id: "ciudad", label: "Ciudad", type: "text" },
    ] },
    { id: "legal", kind: "legal", legalText: "...", habeasData: "...", acceptId: "acepta" },
    { id: "firmas", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};

const full: ConsentState = {
  values: { nombres: "Juan", apellidos: "Perez", tipoDoc: "CC", numDoc: "1", ciudad: "Bogota" },
  firma: "data:image/png;base64,AA", firmaResp: "", foto: "", accepted: true,
};

describe("consentState", () => {
  it("collectMissing exige requeridos, aceptación y firma", () => {
    expect(collectMissing(def, full)).toHaveLength(0);
    const miss = collectMissing(def, { ...full, values: {}, accepted: false, firma: "" });
    expect(miss).toContain("Nombres");
    expect(miss).toContain("Aceptar el consentimiento informado");
  });

  it("flattenConsent incluye valores + firma + aceptación", () => {
    const flat = flattenConsent(def, full);
    expect(flat.firma_paciente).toBe("data:image/png;base64,AA");
    expect(flat.acepta).toBe("Sí");
  });

  it("buildCreatePayload separa identidad de respuestas", () => {
    const p = buildCreatePayload(def, full);
    expect(p.tipo).toBe("vih");
    expect(p.nombres).toBe("Juan");
    expect(p.numDoc).toBe("1");
    expect(p.firmaPaciente).toBe("data:image/png;base64,AA");
    expect(p.respuestas.acepta).toBe("Sí");
    expect(p.respuestas.nombres).toBeUndefined();
    expect(p.apellidos).toBe("Perez");
  });

  it("buildCreatePayload manda apellidos=undefined cuando está ausente (backend → null)", () => {
    const noApellidos = { ...full, values: { ...full.values, apellidos: "" } };
    const p = buildCreatePayload(def, noApellidos);
    expect(p.apellidos).toBeUndefined();
  });
});
