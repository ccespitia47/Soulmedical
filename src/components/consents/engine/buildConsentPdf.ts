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

/** `fields` como filas de dos columnas: una pareja etiqueta: valor por celda.
 *  Se usa en bloques sin preguntas, donde la tabla tiene 2 columnas iguales. */
function fieldsRows(section: FieldsSection, flat: Record<string, string>): string {
  const cells = section.fields
    .map(
      (f) =>
        `<td style="${TD}"><strong>${escapeHtml(f.label)}:</strong> ${fieldValue(flat[f.id] ?? "")}</td>`,
    )
    .map((cell, i) => (i % 2 === 0 ? `<tr>${cell}` : `${cell}</tr>`))
    .join("");
  // Número impar de campos: se cierra la última fila con una celda vacía.
  return section.fields.length % 2 === 1 ? `${cells}<td style="${TD}"></td></tr>` : cells;
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

/** `fields` como UNA fila a todo el ancho (ej. "Si la respuesta es afirmativa,
 *  ¿cuándo?", "Hace cuánto / ¿Por cuánto tiempo?"). Se usa en bloques con
 *  preguntas, donde las columnas estrechas de SI/No impiden repartir los
 *  campos en dos mitades legibles. Fondo tenue para distinguirlos de las
 *  preguntas sin sacarlos del recuadro. */
function fieldsFullWidthRow(section: FieldsSection, flat: Record<string, string>, colspan: number): string {
  const inner = section.fields
    .map((f) => `<strong>${escapeHtml(f.label)}:</strong> ${fieldValue(flat[f.id] ?? "")}`)
    .join("&nbsp;&nbsp;&nbsp;&nbsp;");
  return `<tr><td style="${TD}background:#f7f9fb;" colspan="${colspan}">${inner}</td></tr>`;
}

type ConditionsSection = Extract<ConsentSection, { kind: "conditions" }>;

/** `conditions` como fila a todo el ancho: etiqueta del grupo y casillas en
 *  línea. Cada opción es indivisible (`nowrap`) para que la casilla nunca
 *  quede en una línea y su etiqueta en la siguiente. */
function conditionsRow(section: ConditionsSection, flat: Record<string, string>, colspan: number): string {
  const value = flat[section.group.id] ?? "";
  const selected = new Set(value ? value.split("; ") : []);
  const options = section.group.options
    .map(
      (opt) =>
        `<span style="display:inline-block;white-space:nowrap;margin:0 20px 7px 0;">${boxInline(selected.has(opt))}&nbsp;${escapeHtml(opt)}</span>`,
    )
    .join("");
  return `
    <tr>
      <td style="${TD}" colspan="${colspan}">
        <div style="margin-bottom:7px;">${escapeHtml(section.group.label)}</div>
        <div style="margin-bottom:-7px;">${options}</div>
      </td>
    </tr>`;
}

/** Cabecera de las columnas de respuesta. Se emite UNA vez por bloque, justo
 *  antes de su primera pregunta. */
function questionHeaderRow(thirdLabel: string): string {
  return `
    <tr data-pdf-keep-next>
      <th style="${TH}text-align:left;">Responda las preguntas marcando las casillas correspondientes.</th>
      <th style="${TH}">SI</th>
      <th style="${TH}">No</th>
      <th style="${TH}">${escapeHtml(thirdLabel)}</th>
    </tr>`;
}

/** Bloque CON preguntas: tabla de 4 columnas (texto + SI/No/tercera opción).
 *  Los `fields` y `conditions` del bloque entran como filas a todo el ancho,
 *  así que las continuaciones quedan dentro del mismo recuadro. */
function questionBlockHtml(
  sections: ConsentSection[],
  title: string | undefined,
  firstTri: TristateSection,
  flat: Record<string, string>,
): string {
  const thirdLabel = firstTri.questions[0]?.thirdLabel ?? "No aplica";
  let headerEmitted = false;
  const rows = sections
    .map((s) => {
      if (s.kind === "tristate") {
        const header = headerEmitted ? "" : questionHeaderRow(thirdLabel);
        headerEmitted = true;
        return header + s.questions.map((q) => questionRow(q, flat)).join("");
      }
      if (s.kind === "fields") return fieldsFullWidthRow(s, flat, 4);
      if (s.kind === "conditions") return conditionsRow(s, flat, 4);
      return "";
    })
    .join("");
  return `
    <div data-pdf-block style="${BLOCK}">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col/><col style="width:40px"/><col style="width:40px"/><col style="width:56px"/></colgroup>
        ${title ? barRowHtml(title, 4) : ""}
        ${rows}
      </table>
    </div>`;
}

/** Bloque SIN preguntas: tabla de 2 columnas iguales. Los `fields` ocupan una
 *  celda cada uno y los `conditions` una fila completa. */
function plainBlockHtml(
  sections: ConsentSection[],
  title: string | undefined,
  flat: Record<string, string>,
): string {
  const rows = sections
    .map((s) => {
      if (s.kind === "fields") return fieldsRows(s, flat);
      if (s.kind === "conditions") return conditionsRow(s, flat, 2);
      return "";
    })
    .join("");
  return `
    <div data-pdf-block style="${BLOCK}">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup><col style="width:50%"/><col style="width:50%"/></colgroup>
        ${title ? barRowHtml(title, 2) : ""}
        ${rows}
      </table>
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

export type SectionBlock =
  | { kind: "block"; sections: ConsentSection[] }
  | { kind: "standalone"; section: ConsentSection };

/** Secciones que siempre forman un bloque propio y nunca absorben a la
 *  siguiente: o tienen su propia rejilla de columnas (`vaccineTable`) o no son
 *  tabulares (`legal`, `signatures`, `photo`). Dejar las firmas fuera también
 *  permite que la paginación las pase enteras a la página siguiente. */
const OWN_BLOCK_KINDS: ReadonlyArray<ConsentSection["kind"]> = [
  "vaccineTable",
  "legal",
  "signatures",
  "photo",
];

/** Agrupa las secciones en los bloques que se imprimen como un solo recuadro.
 *
 *  Regla general: **una sección SIN título continúa a la anterior**. Es el
 *  contrato que siguen todas las definiciones — los ids lo dicen (`…Detalle`,
 *  `…Otra`): un título abre una sección nueva y lo que viene sin título es su
 *  continuación ("Otra ¿cuál?", "Hace cuánto", "Si la respuesta es afirmativa,
 *  ¿cuándo?"). Antes esas continuaciones se emitían como tablas sueltas y
 *  quedaban flotando fuera del recuadro al que pertenecen.
 *
 *  Un bloque reúne `fields`, `conditions` y `tristate`; el resto (ver
 *  `OWN_BLOCK_KINDS`) va suelto. */
export function groupSections(sections: ConsentSection[]): SectionBlock[] {
  const out: SectionBlock[] = [];
  let current: ConsentSection[] | null = null;
  for (const section of sections) {
    if (OWN_BLOCK_KINDS.includes(section.kind)) {
      current = null;
      out.push({ kind: "standalone", section });
      continue;
    }
    if (section.title || current === null) {
      current = [section];
      out.push({ kind: "block", sections: current });
    } else {
      current.push(section);
    }
  }
  return out;
}

/** Un bloque se dibuja como tabla de 4 columnas si contiene preguntas, y de 2
 *  columnas si no. Así las continuaciones comparten recuadro con la sección a
 *  la que pertenecen en vez de salir sueltas. */
function blockHtml(sections: ConsentSection[], flat: Record<string, string>): string {
  const title = sections[0].title;
  const firstTri = sections.find((s): s is TristateSection => s.kind === "tristate");
  return firstTri
    ? questionBlockHtml(sections, title, firstTri, flat)
    : plainBlockHtml(sections, title, flat);
}

function standaloneHtml(section: ConsentSection, flat: Record<string, string>): string {
  switch (section.kind) {
    case "vaccineTable":
      return vaccineTableSectionHtml(section, flat);
    case "legal":
      return legalSectionHtml(section);
    case "signatures":
      return signaturesSectionHtml(section, flat);
    case "photo":
      return photoSectionHtml(section, flat);
    // El resto de `kind` llega siempre dentro de un bloque.
    default:
      return "";
  }
}

/** Construye el HTML completo del PDF de un consentimiento, agrupando primero
 *  las secciones en bloques y dibujando cada bloque como un único recuadro. */
export function buildConsentPdf(def: ConsentDefinition, flat: Record<string, string>): string {
  const body = groupSections(def.sections)
    .map((g) => (g.kind === "block" ? blockHtml(g.sections, flat) : standaloneHtml(g.section, flat)))
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
