import { describe, it, expect } from "vitest";
import { buildConsentPdf } from "./buildConsentPdf";
import type { ConsentDefinition } from "./consentDefinition";

const def: ConsentDefinition = {
  meta: { tipo: "vih", titulo: "Consentimiento VIH", entidadNombre: "SOULMEDICAL", displayName: "SOUL", codigo: "C1", version: "2", logo: "" },
  sections: [
    { id: "g", kind: "fields", title: "Datos", fields: [{ id: "nombres", label: "Nombres", type: "text" }] },
    { id: "legal", kind: "legal", legalText: "Párrafo 1\n\nPárrafo 2", habeasData: "HD", acceptId: "acepta" },
    { id: "f", kind: "signatures", firmaPaciente: { id: "firma_paciente", label: "Firma" } },
  ],
};

describe("buildConsentPdf", () => {
  it("incluye título, código/versión, valores y firma embebida", () => {
    const html = buildConsentPdf(def, { nombres: "Juan", firma_paciente: "data:image/png;base64,AA", acepta: "Sí" });
    expect(html).toContain("Consentimiento VIH");
    expect(html).toContain("C1");
    expect(html).toContain("Juan");
    expect(html).toContain("Párrafo 2");
    expect(html).toContain("data:image/png;base64,AA");
  });

  it("no emite un <img> vivo cuando la data-URL de la firma trae un mime no permitido (XSS)", () => {
    // Simula un contentType manipulado que intenta cerrar el atributo src y
    // agregar un handler (ej. onerror) — aunque llegara así desde el backend,
    // buildConsentPdf debe rechazarlo por su cuenta.
    const malicious = 'data:image/png" onerror=alert(1);base64,AAAA';
    const html = buildConsentPdf(def, { nombres: "Juan", firma_paciente: malicious, acepta: "Sí" });
    expect(html).not.toContain("onerror");
    expect(html).not.toContain(malicious);
    expect(html).not.toContain(`src="${malicious}"`);
  });

  it("no emite <img> vacío cuando falta la firma o la foto", () => {
    const withPhoto: ConsentDefinition = {
      ...def,
      sections: [
        ...def.sections,
        { id: "p", kind: "photo", photo: { id: "foto", label: "Foto" } },
      ],
    };
    const html = buildConsentPdf(withPhoto, { nombres: "Juan" });
    expect(html).not.toContain('<img src="">');
    expect(html).not.toContain("<img src=\"\"");
  });

  it("renderiza tristate, conditions y vaccineTable", () => {
    const def2: ConsentDefinition = {
      meta: { tipo: "vac", titulo: "Consentimiento Vacunación", entidadNombre: "SOUL", displayName: "SOUL", codigo: "C2", version: "1", logo: "" },
      sections: [
        {
          id: "t",
          kind: "tristate",
          questions: [{ id: "q1", num: "1", text: "¿Alergias?", thirdLabel: "No aplica" }],
        },
        {
          id: "c",
          kind: "conditions",
          group: { id: "cond", label: "Condiciones", options: ["Diabetes", "Asma"] },
        },
        {
          id: "vt",
          kind: "vaccineTable",
          columns: [{ id: "vacuna", label: "Vacuna" }, { id: "fecha", label: "Fecha" }],
        },
      ],
    };
    const flat = {
      q1: "Sí",
      cond: "Diabetes; Asma",
      vt: JSON.stringify([{ vacuna: "Fiebre amarilla", fecha: "2024-01-01" }]),
    };
    const html = buildConsentPdf(def2, flat);
    expect(html).toContain("¿Alergias?");
    expect(html).toContain("Diabetes");
    expect(html).toContain("Asma");
    expect(html).toContain("Fiebre amarilla");
    expect(html).toContain("2024-01-01");
  });
});
