import { describe, it, expect } from "vitest";
import { buildConsentPdf, groupSections } from "./buildConsentPdf";
import type { ConsentDefinition, ConsentSection } from "./consentDefinition";
import { vacunacionDefinition } from "../definitions/vacunacion";

const QUESTION_HEADER = "Responda las preguntas marcando las casillas correspondientes.";

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

  it("marca cada bloque y protege los encabezados para la paginación", () => {
    const html = buildConsentPdf(def, { nombres: "Juan" });
    expect(html).toContain("data-pdf-block");
    // La barra "Consentimiento informado" no puede quedar sola al pie.
    expect(html).toMatch(/data-pdf-keep-next[^>]*>[\s\S]{0,120}CONSENTIMIENTO INFORMADO/i);
  });
});

describe("groupSections", () => {
  const tri = (id: string, title?: string): ConsentSection => ({
    id,
    kind: "tristate",
    title,
    questions: [{ id: `${id}q`, num: "1", text: "¿?", thirdLabel: "No está seguro" }],
  });
  const fields = (id: string, title?: string): ConsentSection => ({
    id,
    kind: "fields",
    title,
    fields: [{ id: `${id}f`, label: "Fecha", type: "text" }],
  });

  it("fusiona tristates consecutivos sin título y los campos intercalados", () => {
    const groups = groupSections([tri("a"), fields("nota"), tri("b")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("tristate-group");
  });

  it("un título empieza un grupo nuevo", () => {
    const groups = groupSections([tri("a"), tri("b", "Sección B")]);
    expect(groups).toHaveLength(2);
  });

  it("no absorbe un `fields` que no está entre dos tristates", () => {
    const groups = groupSections([tri("a"), fields("suelto")]);
    expect(groups).toHaveLength(2);
    expect(groups[1].kind).toBe("single");
  });
});

// Regresión del formato impreso: la Sección A de Vacunación está partida en
// varias secciones del motor (tétanos / condiciones / antineumocócica / fecha /
// herpes). Antes cada tristate emitía su propia tabla con cabecera, así que la
// fila "Responda las preguntas…" salía repetida entre pregunta y pregunta.
describe("buildConsentPdf · Vacunación", () => {
  it("emite una sola cabecera de preguntas por sección (A, B y virus vivos)", () => {
    const def = vacunacionDefinition("soul");
    const html = buildConsentPdf(def, {});
    expect(html.split(QUESTION_HEADER).length - 1).toBe(3);
  });

  it("la nota «¿cuándo?» va dentro de la tabla, no en una tabla aparte", () => {
    const def = vacunacionDefinition("soul");
    const html = buildConsentPdf(def, {});
    expect(html).toMatch(/<tr><td[^>]*colspan="4"[^>]*>[\s\S]*?afirmativa/i);
  });

  it("dibuja la marca de la casilla sin texto, para que no pueda desplazarse", () => {
    const def = vacunacionDefinition("soul");
    const a = def.sections.find((s) => s.id === "seccionA-antineumococica");
    const qId = a && a.kind === "tristate" ? a.questions[0].id : "";
    const html = buildConsentPdf(def, { [qId]: "No" });
    // La marca es un bloque con `background`, no un glifo: html2canvas la
    // posiciona por caja, no por línea base. Ver nota en `boxCell`.
    expect(html).toContain("background:#111");
    expect(html).not.toMatch(/>X<\/(div|span)>/);
  });
});
