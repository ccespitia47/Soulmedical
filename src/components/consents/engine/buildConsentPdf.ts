// Construye el HTML de un consentimiento genérico (config-driven) para el PDF
// adjunto al correo, a partir de una `ConsentDefinition` (Task 2) y el mapa
// aplanado de respuestas (`flattenConsent`, Task 4). Reutiliza estilos y
// estructura de `vaccinationConsentPdf.ts` (encabezado, tablas, firmas, legal)
// pero recorriendo `def.sections` en vez de una config fija por entidad.

import type {
  ConsentDefinition,
  ConsentSection,
  TriStateQ,
} from "./consentDefinition";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Estilos base reutilizados de vaccinationConsentPdf.ts.
const BORDER = "1px solid #333";
const TD = `padding:4px 6px;border:${BORDER};font-size:10px;vertical-align:top;`;
const TH = `padding:4px 6px;border:${BORDER};font-size:9px;font-weight:700;text-align:center;background:#e9edf2;vertical-align:middle;`;
const BOX_TD = `padding:4px;border:${BORDER};text-align:center;vertical-align:middle;`;
const BAR = `padding:4px 6px;border:${BORDER};background:#5b636b;color:#fff;font-size:10px;font-weight:700;`;

/** Casilla cuadrada; muestra una X si está marcada. */
function box(checked: boolean): string {
  return `<span style="display:inline-block;width:11px;height:11px;border:${BORDER};text-align:center;line-height:10px;font-size:9px;font-weight:700;">${checked ? "X" : ""}</span>`;
}

/** Valor diligenciado, en negrita (sin subrayado, evita artefactos en html2canvas). */
function fieldValue(value: string): string {
  return `<span style="font-weight:600;color:#111;">${escapeHtml(value)}</span>`;
}

// Data-URL de imagen bien formada: solo mimes de imagen soportados + base64
// puro. No confiamos en que el backend ya haya saneado `contentType` — si
// alguna vez llega algo como `data:image/png" onerror=...;base64,...`
// (inyección de atributo), este regex lo rechaza y cae al espaciador en vez
// de emitir un `<img>` vivo, ya que `htmlToPdfBase64` renderiza este HTML en
// un iframe same-origin no aislado.
const SAFE_IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i;

/** Imagen embebida (firma/foto); si no hay dataUrl (o no es una data-URL de
 *  imagen segura), deja un espacio en blanco en vez de emitir un `<img>`
 *  potencialmente inyectado o roto. */
function imageBlock(dataUrl: string, label: string, maxHeight = 70): string {
  const img = SAFE_IMAGE_DATA_URL_RE.test(dataUrl)
    ? `<img src="${dataUrl}" alt="${escapeHtml(label)}" style="max-height:${maxHeight}px;max-width:100%;object-fit:contain;display:block;" />`
    : `<div style="height:${Math.min(maxHeight, 60)}px;"></div>`;
  return `
    <div style="margin-top:14px;">
      ${img}
      <div style="border-top:1px solid #333;padding-top:3px;font-size:10px;">${escapeHtml(label)}</div>
    </div>`;
}

/** Sección `fields`: parejas etiqueta: valor en dos columnas. */
function fieldsSectionHtml(section: Extract<ConsentSection, { kind: "fields" }>, flat: Record<string, string>): string {
  const cells = section.fields
    .map(
      (f) => `
      <td style="padding:4px 8px;font-size:10px;width:50%;">
        <strong>${escapeHtml(f.label)}:</strong>
        ${fieldValue(flat[f.id] ?? "")}
      </td>`,
    )
    .map((cell, i) => (i % 2 === 0 ? `<tr>${cell}` : `${cell}</tr>`))
    .join("");
  const closed = section.fields.length % 2 === 1 ? `${cells}<td></td></tr>` : cells;
  return `
    ${section.title ? `<div style="${BAR};margin-bottom:0;">${escapeHtml(section.title)}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">${closed}</table>`;
}

/** Fila de pregunta tri-estado con su número, texto, nota y respuesta marcada. */
function questionRow(q: TriStateQ, flat: Record<string, string>): string {
  const value = flat[q.id] ?? "";
  const note = q.note ? (flat[q.note.id] ?? "").trim() : "";
  const noteHtml =
    q.note !== undefined
      ? `<div style="margin-top:2px;color:#333;">${escapeHtml(q.note.label)} ${fieldValue(note)}</div>`
      : "";
  return `
    <tr>
      <td style="${TD}"><strong>${escapeHtml(q.num)}.</strong> ${escapeHtml(q.text)}${noteHtml}</td>
      <td style="${BOX_TD}">${box(value === "Sí")}</td>
      <td style="${BOX_TD}">${box(value === "No")}</td>
      <td style="${BOX_TD}">${box(value === q.thirdLabel)}</td>
    </tr>`;
}

/** Sección `tristate`: tabla de preguntas numeradas con casillas SI/No/(tercera opción). */
function tristateSectionHtml(section: Extract<ConsentSection, { kind: "tristate" }>, flat: Record<string, string>): string {
  const thirdLabel = section.questions[0]?.thirdLabel ?? "No aplica";
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed;">
      <colgroup><col/><col style="width:38px"/><col style="width:38px"/><col style="width:54px"/></colgroup>
      ${section.title ? `<tr><td style="${BAR}" colspan="4">${escapeHtml(section.title)}</td></tr>` : ""}
      <tr>
        <th style="${TH};text-align:left;">Responda las preguntas marcando las casillas correspondientes.</th>
        <th style="${TH}">SI</th>
        <th style="${TH}">No</th>
        <th style="${TH}">${escapeHtml(thirdLabel)}</th>
      </tr>
      ${section.questions.map((q) => questionRow(q, flat)).join("")}
    </table>`;
}

/** Sección `conditions`: casillas en línea del grupo, con las opciones seleccionadas marcadas. */
function conditionsSectionHtml(section: Extract<ConsentSection, { kind: "conditions" }>, flat: Record<string, string>): string {
  const value = flat[section.group.id] ?? "";
  const selected = new Set(value ? value.split("; ") : []);
  const options = section.group.options
    .map((opt) => `${box(selected.has(opt))} ${escapeHtml(opt)}`)
    .join("&nbsp;&nbsp; ");
  return `
    <div style="margin-bottom:10px;font-size:10px;">
      ${section.title ? `<div style="${BAR};margin-bottom:4px;">${escapeHtml(section.title)}</div>` : ""}
      <div style="margin-bottom:3px;">${escapeHtml(section.group.label)}</div>
      <div>${options}</div>
    </div>`;
}

/** Sección `vaccineTable`: tabla a partir del JSON de filas guardado en `flat[section.id]`. */
function vaccineTableSectionHtml(section: Extract<ConsentSection, { kind: "vaccineTable" }>, flat: Record<string, string>): string {
  let rows: Array<Record<string, string>> = [];
  const raw = flat[section.id] ?? "";
  if (raw) {
    try {
      rows = JSON.parse(raw);
    } catch {
      rows = [];
    }
  }
  if (!rows.length) rows = [{}];

  const head = section.columns.map((c) => `<th style="${TH}">${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${section.columns
          .map((c) => `<td style="${TD};height:18px;">${escapeHtml(r[c.id] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `
    ${section.title ? `<div style="${BAR};margin-bottom:0;">${escapeHtml(section.title)}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>${head}</tr>
      ${body}
    </table>`;
}

/** Sección `legal`: párrafos del texto de consentimiento + Habeas Data. */
function legalSectionHtml(section: Extract<ConsentSection, { kind: "legal" }>): string {
  const toParagraphs = (text: string) =>
    text
      .split("\n\n")
      .map((p) => `<p style="margin:0 0 8px;text-align:justify;line-height:1.45;font-size:10px;">${escapeHtml(p)}</p>`)
      .join("");
  return `
    <div style="${BAR};margin-bottom:6px;">${escapeHtml(section.title ?? "CONSENTIMIENTO INFORMADO")}</div>
    ${toParagraphs(section.legalText)}
    ${toParagraphs(section.habeasData)}`;
}

/** Sección `signatures`: firma de paciente y, si aplica, de responsable. */
function signaturesSectionHtml(section: Extract<ConsentSection, { kind: "signatures" }>, flat: Record<string, string>): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="width:50%;vertical-align:bottom;padding-right:20px;">${imageBlock(flat[section.firmaPaciente.id] ?? "", section.firmaPaciente.label)}</td>
        ${
          section.firmaResponsable
            ? `<td style="width:50%;vertical-align:bottom;">${imageBlock(flat[section.firmaResponsable.id] ?? "", section.firmaResponsable.label)}</td>`
            : `<td style="width:50%;"></td>`
        }
      </tr>
    </table>`;
}

/** Sección `photo`: imagen embebida (ej. foto del paciente). */
function photoSectionHtml(section: Extract<ConsentSection, { kind: "photo" }>, flat: Record<string, string>): string {
  return imageBlock(flat[section.photo.id] ?? "", section.photo.label, 140);
}

/** Encabezado oficial: logo, título y recuadro de código/versión. */
function headerHtml(def: ConsentDefinition): string {
  const m = def.meta;
  const logo = m.logo
    ? `<img src="${m.logo}" alt="${escapeHtml(m.displayName)}" style="max-height:46px;max-width:100%;object-fit:contain;" />`
    : "";
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <td style="border:${BORDER};width:24%;text-align:center;padding:6px;">${logo}</td>
        <td style="border:${BORDER};text-align:center;padding:6px;font-size:11px;font-weight:700;line-height:1.4;">
          ${escapeHtml(m.entidadNombre)}<br/>${escapeHtml(m.titulo)}
        </td>
        <td style="border:${BORDER};width:26%;padding:0;font-size:9px;">
          <div style="border-bottom:${BORDER};padding:4px 6px;">CÓDIGO: ${escapeHtml(m.codigo)}</div>
          <div style="padding:4px 6px;">VERSIÓN: ${escapeHtml(m.version)}</div>
        </td>
      </tr>
    </table>`;
}

/** Construye el HTML completo del PDF de un consentimiento, recorriendo
 *  `def.sections` y emitiendo la primitiva correspondiente a cada `kind`. */
export function buildConsentPdf(def: ConsentDefinition, flat: Record<string, string>): string {
  const body = def.sections
    .map((section) => {
      switch (section.kind) {
        case "fields":
          return fieldsSectionHtml(section, flat);
        case "tristate":
          return tristateSectionHtml(section, flat);
        case "conditions":
          return conditionsSectionHtml(section, flat);
        case "vaccineTable":
          return vaccineTableSectionHtml(section, flat);
        case "legal":
          return legalSectionHtml(section);
        case "signatures":
          return signaturesSectionHtml(section, flat);
        case "photo":
          return photoSectionHtml(section, flat);
        default:
          return "";
      }
    })
    .join("\n");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111;padding:14px 16px;">
    ${headerHtml(def)}
    ${body}
  </div>`;
}
