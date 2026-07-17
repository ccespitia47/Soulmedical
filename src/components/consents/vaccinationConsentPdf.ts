// Construye el HTML del Consentimiento de Vacunación (por entidad) para el PDF
// adjunto al correo. Replica la maqueta del formato oficial SV-FT: encabezado
// con recuadros de Código/Fecha/Versión, datos generales, secciones A/B/virus
// vivos con casillas SI/No/(tercera opción) marcadas, tabla de vacunas
// (Sección C), efectos adversos (SAI), consentimiento, Habeas Data y firmas.

import {
  SIGNATURE_FIELD_ID,
  SIGNATURE_RESP_FIELD_ID,
  type EntityConfig,
  type TriStateQ,
} from "./config";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Textos fijos del formato (idénticos en ambos PDFs) ──────────────────────
const INTRO_PACIENTES =
  'Para pacientes: las siguientes preguntas nos ayudarán a determinar qué vacunas se le pueden administrar hoy. Si responde "sí" a cualquier pregunta, no significa necesariamente que no deba vacunarse. Solo significa que se deben hacer preguntas adicionales. Si alguna de las preguntas no está clara, solicite a nuestro personal de vacunación que le brinde la asesoría pertinente.';
const INTRO_CONFIDENCIAL =
  "La información suministrada en este formato es confidencial, solo será utilizada para brindarle una atención integral, evitando complicaciones relacionadas con la vacunación.";

// Estilos base reutilizados.
const BORDER = "1px solid #333";
const TD = `padding:4px 6px;border:${BORDER};font-size:10px;vertical-align:top;`;
const TH = `padding:4px 6px;border:${BORDER};font-size:9px;font-weight:700;text-align:center;background:#e9edf2;`;
const BOX_TD = `padding:4px;border:${BORDER};text-align:center;width:34px;`;
const BAR = `padding:4px 6px;border:${BORDER};background:#5b636b;color:#fff;font-size:10px;font-weight:700;`;
const SUBBAR = `padding:3px 6px;border:${BORDER};background:#d9dee4;font-size:9px;font-weight:700;`;

/** Casilla cuadrada; muestra una X si está marcada. */
function box(checked: boolean): string {
  return `<span style="display:inline-block;width:11px;height:11px;border:${BORDER};text-align:center;line-height:10px;font-size:9px;font-weight:700;">${checked ? "X" : ""}</span>`;
}

/** Tres celdas de casilla alineadas al valor de la pregunta. */
function boxCells(value: string, thirdLabel: string): string {
  return (
    `<td style="${BOX_TD}">${box(value === "Sí")}</td>` +
    `<td style="${BOX_TD}">${box(value === "No")}</td>` +
    `<td style="${BOX_TD}">${box(value === thirdLabel)}</td>`
  );
}

/** Encabezado de columnas SI / No / (tercera opción). */
function headerRow(leftLabel: string, thirdLabel: string): string {
  return `
    <tr>
      <th style="${TH};text-align:left;">${escapeHtml(leftLabel)}</th>
      <th style="${TH}">SI</th>
      <th style="${TH}">No</th>
      <th style="${TH}">${escapeHtml(thirdLabel)}</th>
    </tr>`;
}

/** Fila de pregunta tri-estado con su número y casillas marcadas. */
function questionRow(q: TriStateQ, values: Record<string, string>): string {
  const value = values[q.id] ?? "";
  const note = q.note ? (values[q.note.id] ?? "").trim() : "";
  const noteHtml =
    q.note !== undefined
      ? `<div style="margin-top:2px;color:#333;">${escapeHtml(q.note.label)} <span style="border-bottom:1px solid #999;">${escapeHtml(note)}</span></div>`
      : "";
  return `
    <tr>
      <td style="${TD}"><strong>${q.num}.</strong> ${escapeHtml(q.text)}${noteHtml}</td>
      ${boxCells(value, q.thirdLabel)}
    </tr>`;
}

/** Casillas en línea del grupo de condiciones (Sección A). */
function conditionsInline(options: string[], value: string): string {
  const selected = new Set(value ? value.split("; ") : []);
  return options
    .map((opt) => `${box(selected.has(opt))} ${escapeHtml(opt)}`)
    .join("&nbsp;&nbsp; ");
}

/** Datos generales: parejas etiqueta: valor en dos columnas con subrayado. */
function generalDataHtml(config: EntityConfig, values: Record<string, string>): string {
  const cells = config.datosGenerales
    .map(
      (f) => `
      <td style="padding:3px 6px;font-size:10px;width:50%;">
        <strong>${escapeHtml(f.label)}:</strong>
        <span style="border-bottom:1px solid #333;">&nbsp;${escapeHtml(values[f.id] ?? "")}&nbsp;</span>
      </td>`,
    )
    .map((cell, i) => (i % 2 === 0 ? `<tr>${cell}` : `${cell}</tr>`))
    .join("");
  // Si el número de campos es impar, cierra la última fila.
  const closed = config.datosGenerales.length % 2 === 1 ? `${cells}<td></td></tr>` : cells;
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${closed}</table>`;
}

/** Sección A: historial (tétanos opcional + condiciones/antineumocócica + herpes). */
function seccionAHtml(config: EntityConfig, values: Record<string, string>): string {
  const a = config.seccionA;
  const third = a.antineumococica.thirdLabel;

  const tetanosRow = a.tetanosAnios
    ? `<tr><td style="${TD}" colspan="4"><strong>1.</strong> ¿Cuánto tiempo ha pasado desde su última inyección contra el TÉTANOS? <span style="border-bottom:1px solid #333;">&nbsp;${escapeHtml(values[a.tetanosAnios.id] ?? "")}&nbsp;</span> años</td></tr>`
    : "";

  const fecha = (values[a.antineumococicaFecha.id] ?? "").trim();
  const condCell = `
    <td style="${TD}">
      <div style="margin-bottom:3px;">${escapeHtml(a.condiciones.label)}</div>
      <div style="margin-bottom:3px;">${conditionsInline(a.condiciones.options, values[a.condiciones.id] ?? "")}</div>
      <div><strong>${a.antineumococica.num}.</strong> ${escapeHtml(a.antineumococica.text)}</div>
      <div style="margin-top:2px;color:#333;">${escapeHtml(a.antineumococicaFecha.label)} <span style="border-bottom:1px solid #999;">&nbsp;${escapeHtml(fecha)}&nbsp;</span></div>
    </td>`;

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr><td style="${BAR}" colspan="4">Sección A: Historial de vacunas (obligatorio)</td></tr>
      ${headerRow("Responda las preguntas marcando las casillas correspondientes.", third)}
      <tr><td style="${SUBBAR}" colspan="4">Todas las vacunas</td></tr>
      ${tetanosRow}
      <tr>${condCell}${boxCells(values[a.antineumococica.id] ?? "", third)}</tr>
      ${questionRow(a.herpesZoster, values)}
    </table>`;
}

/** Tabla de una lista de preguntas (Sección B o virus vivos). */
function questionsTableHtml(
  title: string,
  subBar: string,
  questions: TriStateQ[],
  values: Record<string, string>,
  thirdLabel: string,
): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr><td style="${BAR}" colspan="4">${escapeHtml(title)}</td></tr>
      ${headerRow("Responda las preguntas marcando las casillas correspondientes.", thirdLabel)}
      <tr><td style="${SUBBAR}" colspan="4">${escapeHtml(subBar)}</td></tr>
      ${questions.map((q) => questionRow(q, values)).join("")}
    </table>`;
}

/** Sección C: tabla de datos de vacunas aplicadas. */
function seccionCHtml(config: EntityConfig, raw: string): string {
  let rows: Array<Record<string, string>> = [];
  if (raw) {
    try {
      rows = JSON.parse(raw);
    } catch {
      rows = [];
    }
  }
  // Al menos una fila (aunque vacía) para conservar la estructura del formato.
  if (!rows.length) rows = [{}];

  const head = config.seccionC.columns
    .map((c) => `<th style="${TH}">${escapeHtml(c.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${config.seccionC.columns
          .map((c) => `<td style="${TD};height:18px;">${escapeHtml(r[c.id] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `
    <div style="${BAR};margin-bottom:0;">SECCIÓN C: DATOS VACUNA(S)</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>${head}</tr>
      ${body}
    </table>`;
}

function signatureBlock(dataUrl: string, label: string): string {
  const img = dataUrl.startsWith("data:image/")
    ? `<img src="${dataUrl}" alt="Firma" style="max-height:70px;max-width:100%;object-fit:contain;display:block;" />`
    : `<div style="height:60px;"></div>`;
  return `
    <div style="margin-top:14px;">
      ${img}
      <div style="border-top:1px solid #333;padding-top:3px;font-size:10px;">${escapeHtml(label)}</div>
    </div>`;
}

export function buildVaccinationConsentHtml(config: EntityConfig, values: Record<string, string>): string {
  const m = config.meta;

  const efectos =
    config.efectosAdversos && config.efectosAdversos.length
      ? `
      <div style="${BAR};margin-bottom:4px;">SECCIÓN D: POSIBLES EFECTOS ADVERSOS ESPERADOS</div>
      <ul style="margin:0 0 12px;padding-left:18px;font-size:10px;line-height:1.45;">
        ${config.efectosAdversos.map((p) => `<li style="margin-bottom:3px;">${escapeHtml(p)}</li>`).join("")}
      </ul>`
      : "";

  const legalParagraphs = config.legalText
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 8px;text-align:justify;line-height:1.45;font-size:10px;">${escapeHtml(p)}</p>`)
    .join("");
  const habeasParagraphs = config.habeasData
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 8px;text-align:justify;line-height:1.45;font-size:10px;">${escapeHtml(p)}</p>`)
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111;padding:14px 16px;">
    <!-- Encabezado oficial -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr>
        <td style="border:${BORDER};width:24%;text-align:center;padding:6px;">
          <img src="${m.logo}" alt="${escapeHtml(m.displayName)}" style="max-height:46px;max-width:100%;object-fit:contain;" />
        </td>
        <td style="border:${BORDER};text-align:center;padding:6px;font-size:11px;font-weight:700;line-height:1.4;">
          PROCESO DE GESTIÓN<br/>SERVICIO DE VACUNACIÓN<br/>CONSENTIMIENTO INFORMADO PARA VACUNACIÓN
        </td>
        <td style="border:${BORDER};width:26%;padding:0;font-size:9px;">
          <div style="border-bottom:${BORDER};padding:4px 6px;">CÓDIGO: ${escapeHtml(m.codigo)}</div>
          <div style="border-bottom:${BORDER};padding:4px 6px;">FECHA: ${escapeHtml(m.fechaFormato)}</div>
          <div style="padding:4px 6px;">VERSIÓN: ${escapeHtml(m.version)}</div>
        </td>
      </tr>
    </table>

    <!-- Datos generales -->
    ${generalDataHtml(config, values)}

    <!-- Intro -->
    <p style="font-size:9px;text-align:justify;margin:0 0 6px;line-height:1.4;">${escapeHtml(INTRO_PACIENTES)}</p>
    <p style="font-size:9px;text-align:justify;font-weight:700;margin:0 0 10px;line-height:1.4;">${escapeHtml(INTRO_CONFIDENCIAL)}</p>

    <!-- Sección A -->
    ${seccionAHtml(config, values)}

    <!-- Sección B -->
    ${questionsTableHtml(
      "Sección B: Cuestionario sobre salud (obligatorio)",
      "Todas las vacunas",
      config.seccionB,
      values,
      config.seccionB[0]?.thirdLabel ?? "No está seguro",
    )}

    <!-- Virus vivos -->
    ${questionsTableHtml(
      "Vacunas de virus vivos (varicela, MMR® II, tifoidea oral, herpes, fiebre amarilla, cólera)",
      "Preguntas adicionales para quienes reciben una vacuna de virus vivos.",
      config.virusVivos,
      values,
      config.virusVivos[0]?.thirdLabel ?? "No aplica",
    )}

    <!-- Sección C -->
    ${seccionCHtml(config, values["seccionC"] ?? "")}

    <!-- Efectos adversos (SAI) -->
    ${efectos}

    <!-- Consentimiento informado -->
    <div style="${BAR};margin-bottom:6px;">CONSENTIMIENTO INFORMADO</div>
    ${legalParagraphs}

    <!-- Habeas Data -->
    ${habeasParagraphs}

    <!-- Firmas -->
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="width:50%;vertical-align:bottom;padding-right:20px;">${signatureBlock(values[SIGNATURE_FIELD_ID] ?? "", config.firmas.firmaPaciente.label)}</td>
        <td style="width:50%;vertical-align:bottom;">${signatureBlock(values[SIGNATURE_RESP_FIELD_ID] ?? "", config.firmas.firmaResponsable.label)}</td>
      </tr>
    </table>
  </div>`;
}
