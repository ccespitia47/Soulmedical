// Construye el HTML de un consentimiento genérico (config-driven) para el PDF
// adjunto al correo, a partir de una `ConsentDefinition` (Task 2) y el mapa
// aplanado de respuestas (`flattenConsent`, Task 4). Reutiliza estilos y
// estructura de `vaccinationConsentPdf.ts` (encabezado, tablas, firmas, legal)
// pero recorriendo `def.sections` en vez de una config fija por entidad.
//
// Maquetación (ver `pdfExporter.ts`):
//  - cada bloque imprimible lleva `data-pdf-block` → `htmlToPdfBase64` lo usa
//    como punto de corte seguro entre páginas;
//  - las barras de sección y las filas de cabecera llevan `data-pdf-keep-next`
//    → nunca queda un título solo al pie de una página.

import type {
  ConsentDefinition,
  ConsentSection,
  FieldsSection,
  TristateSection,
  TriStateQ,
} from "./consentDefinition";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Escala tipográfica y de espaciado del documento.
//
// El formato original iba a 9–10px con 4px de padding vertical: el texto
// quedaba pegado a las líneas de la tabla y costaba leerlo impreso. Estos
// valores dan una línea base más grande y suficiente aire dentro de cada
// celda. Están centralizados a propósito: cambiarlos aquí reajusta todo el
// documento de forma coherente.
const FONT_BODY = "11px";
const FONT_SMALL = "10px"; // cabeceras de columna y recuadro de código
const FONT_TITLE = "12px";
const CELL_PAD = "6px 8px";
const LINE = "1.45";

const BORDER = "1px solid #333";
const TD = `padding:${CELL_PAD};border:${BORDER};font-size:${FONT_BODY};line-height:${LINE};vertical-align:top;`;
const TH = `padding:${CELL_PAD};border:${BORDER};font-size:${FONT_SMALL};line-height:1.35;font-weight:700;text-align:center;background:#e9edf2;vertical-align:middle;`;
const BOX_TD = `padding:6px 2px;border:${BORDER};text-align:center;vertical-align:middle;`;
const BAR = `padding:${CELL_PAD};border:${BORDER};background:#5b636b;color:#fff;font-size:${FONT_BODY};line-height:1.35;font-weight:700;`;
const BLOCK = `margin-bottom:12px;`;

// La marca de "casilla marcada" NO se dibuja con texto.
//
// Antes era una "X" dentro de un cuadro de 12px. En el PDF de producción ese
// glifo aparecía desplazado abajo y a la izquierda, colgando fuera del cuadro
// (html2canvas calcula la posición del texto a partir de métricas de fuente y
// de la línea base del contenedor, y ahí se desalineaba). No se reproduce en
// Chrome headless a DPR 1, 1.25 ni 1.5, así que en vez de perseguir el caso
// se elimina la dependencia: la marca es ahora un bloque con `background`,
// la misma primitiva con la que se dibujan los cuadros vacíos y las barras de
// sección — que siempre salen en su sitio — y no puede desplazarse.
const BOX_SIZE = "width:12px;height:12px;";
const BOX_FRAME = `${BOX_SIZE}border:${BORDER};padding:2px;`;
const BOX_MARK = `<span style="display:block;width:100%;height:100%;background:#111;"></span>`;

/** Casilla centrada en su celda (bloque: no depende de la línea base del td). */
function boxCell(checked: boolean): string {
  return `<div style="${BOX_FRAME}margin:0 auto;">${checked ? BOX_MARK : ""}</div>`;
}

/** Casilla en línea con su etiqueta (listas de condiciones). */
function boxInline(checked: boolean): string {
  return `<span style="display:inline-block;${BOX_FRAME}vertical-align:middle;">${checked ? BOX_MARK : ""}</span>`;
}

/** Valor diligenciado, en negrita (sin subrayado, evita artefactos en html2canvas). */
function fieldValue(value: string): string {
  return `<span style="font-weight:600;color:#111;">${escapeHtml(value)}</span>`;
}

/** Barra de título de sección. `data-pdf-keep-next` impide que la paginación
 *  corte justo debajo y deje el título huérfano al pie de la página. */
function barHtml(title: string): string {
  return `<div data-pdf-keep-next style="${BAR}">${escapeHtml(title)}</div>`;
}

/** Barra de título como fila de una tabla (colspan al ancho de la tabla). */
function barRowHtml(title: string, colspan: number): string {
  return `<tr data-pdf-keep-next><td style="${BAR}" colspan="${colspan}">${escapeHtml(title)}</td></tr>`;
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
      <div style="border-top:1px solid #333;padding-top:5px;font-size:${FONT_BODY};">${escapeHtml(label)}</div>
    </div>`;
}

/** Sección `fields`: parejas etiqueta: valor en dos columnas. */
function fieldsSectionHtml(section: FieldsSection, flat: Record<string, string>): string {
  const cells = section.fields
    .map(
      (f) => `
      <td style="padding:${CELL_PAD};font-size:${FONT_BODY};line-height:${LINE};width:50%;vertical-align:top;">
        <strong>${escapeHtml(f.label)}:</strong>
        ${fieldValue(flat[f.id] ?? "")}
      </td>`,
    )
    .map((cell, i) => (i % 2 === 0 ? `<tr>${cell}` : `${cell}</tr>`))
    .join("");
  const closed = section.fields.length % 2 === 1 ? `${cells}<td></td></tr>` : cells;
  return `
    <div data-pdf-block style="${BLOCK}">
      ${section.title ? barHtml(section.title) : ""}
      <table style="width:100%;border-collapse:collapse;">${closed}</table>
    </div>`;
}

/** Fila de pregunta tri-estado con su número, texto, nota y respuesta marcada. */
function questionRow(q: TriStateQ, flat: Record<string, string>): string {
  const value = flat[q.id] ?? "";
  const note = q.note ? (flat[q.note.id] ?? "").trim() : "";
  const noteHtml =
    q.note !== undefined
      ? `<div style="margin-top:4px;color:#333;">${escapeHtml(q.note.label)} ${fieldValue(note)}</div>`
      : "";
  return `
    <tr>
      <td style="${TD}"><strong>${escapeHtml(q.num)}.</strong> ${escapeHtml(q.text)}${noteHtml}</td>
      <td style="${BOX_TD}">${boxCell(value === "Sí")}</td>
      <td style="${BOX_TD}">${boxCell(value === "No")}</td>
      <td style="${BOX_TD}">${boxCell(value === q.thirdLabel)}</td>
    </tr>`;
}

/** Campos intercalados dentro de una tabla tri-estado (ej. "Si la respuesta es
 *  afirmativa, ¿cuándo?"): fila a todo el ancho, no una tabla aparte. */
function inlineFieldsRow(section: FieldsSection, flat: Record<string, string>): string {
  const inner = section.fields
    .map((f) => `<strong>${escapeHtml(f.label)}:</strong> ${fieldValue(flat[f.id] ?? "")}`)
    .join("&nbsp;&nbsp;&nbsp;&nbsp;");
  return `<tr><td style="${TD}background:#f7f9fb;" colspan="4">${inner}</td></tr>`;
}

/** Secciones tri-estado consecutivas renderizadas como UNA sola tabla: la
 *  cabecera ("Responda las preguntas…" / SI / No / …) se emite una única vez
 *  para todo el grupo, no entre cada par de preguntas. */
function tristateGroupHtml(group: ConsentSection[], flat: Record<string, string>): string {
  const title = group[0].title;
  const firstTri = group.find((s) => s.kind === "tristate") as TristateSection;
  const thirdLabel = firstTri.questions[0]?.thirdLabel ?? "No aplica";
  const rows = group
    .map((s) =>
      s.kind === "tristate"
        ? s.questions.map((q) => questionRow(q, flat)).join("")
        : inlineFieldsRow(s as FieldsSection, flat),
    )
    .join("");
  return `
    <div data-pdf-block style="${BLOCK}">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col/><col style="width:40px"/><col style="width:40px"/><col style="width:56px"/></colgroup>
        ${title ? barRowHtml(title, 4) : ""}
        <tr data-pdf-keep-next>
          <th style="${TH}text-align:left;">Responda las preguntas marcando las casillas correspondientes.</th>
          <th style="${TH}">SI</th>
          <th style="${TH}">No</th>
          <th style="${TH}">${escapeHtml(thirdLabel)}</th>
        </tr>
        ${rows}
      </table>
    </div>`;
}

/** Sección `conditions`: casillas en línea del grupo, con las opciones
 *  seleccionadas marcadas. Cada opción es indivisible (`nowrap`) para que la
 *  casilla nunca quede en una línea y su etiqueta en la siguiente. */
function conditionsSectionHtml(section: Extract<ConsentSection, { kind: "conditions" }>, flat: Record<string, string>): string {
  const value = flat[section.group.id] ?? "";
  const selected = new Set(value ? value.split("; ") : []);
  const options = section.group.options
    .map(
      (opt) =>
        `<span style="display:inline-block;white-space:nowrap;margin:0 20px 7px 0;">${boxInline(selected.has(opt))}&nbsp;${escapeHtml(opt)}</span>`,
    )
    .join("");
  return `
    <div data-pdf-block style="${BLOCK}font-size:10px;line-height:1.4;">
      ${section.title ? barHtml(section.title) : ""}
      <div style="border:${BORDER};padding:${CELL_PAD};">
        <div style="margin-bottom:7px;">${escapeHtml(section.group.label)}</div>
        <div>${options}</div>
      </div>
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
          .map((c) => `<td style="${TD}height:24px;">${escapeHtml(r[c.id] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `
    <div data-pdf-block style="${BLOCK}">
      <table style="width:100%;border-collapse:collapse;">
        ${section.title ? barRowHtml(section.title, section.columns.length) : ""}
        <tr data-pdf-keep-next>${head}</tr>
        ${body}
      </table>
    </div>`;
}

/** Sección `legal`: párrafos del texto de consentimiento + Habeas Data. */
function legalSectionHtml(section: Extract<ConsentSection, { kind: "legal" }>): string {
  const toParagraphs = (text: string) =>
    text
      .split("\n\n")
      .map((p) => `<p style="margin:0 0 10px;text-align:justify;line-height:1.6;font-size:${FONT_BODY};">${escapeHtml(p)}</p>`)
      .join("");
  return `
    <div data-pdf-block style="${BLOCK}">
      ${barHtml(section.title ?? "CONSENTIMIENTO INFORMADO")}
      <div style="padding-top:8px;">
        ${toParagraphs(section.legalText)}
        ${toParagraphs(section.habeasData)}
      </div>
    </div>`;
}

/** Sección `signatures`: firma de paciente y, si aplica, de responsable.
 *  Bloque sin cortes internos: si no cabe al pie de la página, la paginación
 *  lo pasa entero a la siguiente en vez de partir las firmas. */
function signaturesSectionHtml(section: Extract<ConsentSection, { kind: "signatures" }>, flat: Record<string, string>): string {
  return `
    <div data-pdf-block style="margin-top:8px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;vertical-align:bottom;padding-right:20px;">${imageBlock(flat[section.firmaPaciente.id] ?? "", section.firmaPaciente.label)}</td>
          ${
            section.firmaResponsable
              ? `<td style="width:50%;vertical-align:bottom;">${imageBlock(flat[section.firmaResponsable.id] ?? "", section.firmaResponsable.label)}</td>`
              : `<td style="width:50%;"></td>`
          }
        </tr>
      </table>
    </div>`;
}

/** Sección `photo`: imagen embebida (ej. foto del paciente). */
function photoSectionHtml(section: Extract<ConsentSection, { kind: "photo" }>, flat: Record<string, string>): string {
  return `<div data-pdf-block style="${BLOCK}">${imageBlock(flat[section.photo.id] ?? "", section.photo.label, 140)}</div>`;
}

/** Encabezado oficial: logo, título y recuadro de código/versión. */
function headerHtml(def: ConsentDefinition): string {
  const m = def.meta;
  const logo = m.logo
    ? `<img src="${m.logo}" alt="${escapeHtml(m.displayName)}" style="max-height:46px;max-width:100%;object-fit:contain;" />`
    : "";
  return `
    <div data-pdf-block data-pdf-keep-next style="${BLOCK}">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="border:${BORDER};width:24%;text-align:center;padding:6px;">${logo}</td>
          <td style="border:${BORDER};text-align:center;padding:8px;font-size:${FONT_TITLE};font-weight:700;line-height:1.45;">
            ${escapeHtml(m.entidadNombre)}<br/>${escapeHtml(m.titulo)}
          </td>
          <td style="border:${BORDER};width:26%;padding:0;font-size:${FONT_SMALL};line-height:1.4;">
            <div style="border-bottom:${BORDER};padding:5px 8px;">CÓDIGO: ${escapeHtml(m.codigo)}</div>
            <div style="padding:5px 8px;">VERSIÓN: ${escapeHtml(m.version)}</div>
          </td>
        </tr>
      </table>
    </div>`;
}

export type SectionGroup =
  | { kind: "tristate-group"; sections: ConsentSection[] }
  | { kind: "single"; section: ConsentSection };

/** Agrupa secciones consecutivas que son UNA sola tabla en el formato impreso.
 *
 *  Un `tristate` absorbe los `tristate` siguientes que no traen título propio
 *  (un título marca el inicio de otra sección) y los `fields` sin título que
 *  quedan entre dos de ellos: esos campos son notas de la tabla (ej. "Si la
 *  respuesta es afirmativa, ¿cuándo?"), no una sección aparte. Así la cabecera
 *  "Responda las preguntas…" aparece una vez por sección en vez de repetirse
 *  entre cada par de preguntas. */
export function groupSections(sections: ConsentSection[]): SectionGroup[] {
  const out: SectionGroup[] = [];
  let i = 0;
  while (i < sections.length) {
    const section = sections[i];
    if (section.kind !== "tristate") {
      out.push({ kind: "single", section });
      i += 1;
      continue;
    }
    const group: ConsentSection[] = [section];
    let j = i + 1;
    while (j < sections.length) {
      const next = sections[j];
      if (next.title) break;
      if (next.kind === "tristate") {
        group.push(next);
        j += 1;
        continue;
      }
      if (next.kind === "fields") {
        const after = sections[j + 1];
        if (after && after.kind === "tristate" && !after.title) {
          group.push(next);
          j += 1;
          continue;
        }
      }
      break;
    }
    out.push({ kind: "tristate-group", sections: group });
    i = j;
  }
  return out;
}

function singleSectionHtml(section: ConsentSection, flat: Record<string, string>): string {
  switch (section.kind) {
    case "fields":
      return fieldsSectionHtml(section, flat);
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
    // `tristate` nunca llega aquí: `groupSections` lo emite siempre como grupo.
    default:
      return "";
  }
}

/** Construye el HTML completo del PDF de un consentimiento, agrupando primero
 *  las secciones que comparten tabla y emitiendo la primitiva de cada `kind`. */
export function buildConsentPdf(def: ConsentDefinition, flat: Record<string, string>): string {
  const body = groupSections(def.sections)
    .map((g) =>
      g.kind === "tristate-group" ? tristateGroupHtml(g.sections, flat) : singleSectionHtml(g.section, flat),
    )
    .join("\n");

  // `font-size`/`line-height` explícitos en la raíz: sin ellos todo hereda los
  // 16px por defecto del body del iframe y html2canvas dibuja los glifos de las
  // casillas sobre esa línea base, es decir fuera de su cuadro.
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111;font-size:${FONT_BODY};line-height:1.5;padding:16px 18px;">
    ${headerHtml(def)}
    ${body}
  </div>`;
}
