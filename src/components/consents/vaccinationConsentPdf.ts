// Construye el HTML del Consentimiento de Vacunación (por entidad) para el PDF
// adjunto al correo. Renderiza datos generales, secciones A/B/virus vivos,
// tabla de vacunas, textos legales y ambas firmas incrustadas como <img>.

import {
  SIGNATURE_FIELD_ID,
  SIGNATURE_RESP_FIELD_ID,
  PATIENT_DOC_FIELD_ID,
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

function kvRows(pairs: Array<[string, string]>): string {
  return pairs
    .filter(([, v]) => (v ?? "").trim() !== "")
    .map(
      ([label, v]) => `
        <tr>
          <td style="padding:6px 9px;border:1px solid #d7dee8;background:#f5f8fc;font-weight:600;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 9px;border:1px solid #d7dee8;">${escapeHtml(v)}</td>
        </tr>`,
    )
    .join("");
}

function questionRows(questions: TriStateQ[], values: Record<string, string>): string {
  return questions
    .map((q) => {
      const ans = values[q.id] ?? "";
      const note = q.note ? values[q.note.id] ?? "" : "";
      if (!ans && !note) return "";
      const noteHtml = note ? ` <em>(${escapeHtml(note)})</em>` : "";
      return `
        <tr>
          <td style="padding:6px 9px;border:1px solid #d7dee8;width:80%;">${q.num}. ${escapeHtml(q.text)}</td>
          <td style="padding:6px 9px;border:1px solid #d7dee8;font-weight:600;">${escapeHtml(ans)}${noteHtml}</td>
        </tr>`;
    })
    .join("");
}

function vaccineTableHtml(config: EntityConfig, raw: string): string {
  if (!raw) return "";
  let rows: Array<Record<string, string>> = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!rows.length) return "";
  const head = config.seccionC.columns
    .map((c) => `<th style="padding:5px 7px;border:1px solid #d7dee8;background:#f5f8fc;font-size:11px;">${escapeHtml(c.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${config.seccionC.columns
          .map((c) => `<td style="padding:5px 7px;border:1px solid #d7dee8;font-size:11px;">${escapeHtml(r[c.id] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function signatureCell(dataUrl: string, label: string): string {
  const img = dataUrl.startsWith("data:image/")
    ? `<img src="${dataUrl}" alt="Firma" style="max-height:80px;max-width:100%;object-fit:contain;display:block;margin-bottom:6px;" />`
    : `<div style="height:80px;"></div>`;
  return `<td style="width:50%;vertical-align:bottom;padding-right:16px;">${img}<div style="border-top:1px solid #1f2937;padding-top:4px;font-size:11px;">${escapeHtml(label)}</div></td>`;
}

export function buildVaccinationConsentHtml(config: EntityConfig, values: Record<string, string>): string {
  const generalPairs: Array<[string, string]> = config.datosGenerales.map((f) => [f.label, values[f.id] ?? ""]);

  const a = config.seccionA;
  const seccionAPairs: Array<[string, string]> = [];
  if (a.tetanosAnios) seccionAPairs.push([a.tetanosAnios.label, values[a.tetanosAnios.id] ?? ""]);
  seccionAPairs.push([a.condiciones.label, values[a.condiciones.id] ?? ""]);
  const seccionAQuestions = questionRows([a.antineumococica, a.herpesZoster], values);
  const antFecha = (values[a.antineumococicaFecha.id] ?? "").trim();

  const legalParagraphs = config.legalText
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 10px;text-align:justify;line-height:1.5;">${escapeHtml(p)}</p>`)
    .join("");
  const habeasParagraphs = config.habeasData
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 10px;text-align:justify;line-height:1.5;">${escapeHtml(p)}</p>`)
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:12px;padding:22px 26px;">
    <div style="text-align:center;border-bottom:3px solid #00c2a8;padding-bottom:12px;margin-bottom:16px;">
      <img src="${config.meta.logo}" alt="${escapeHtml(config.meta.displayName)}" style="max-height:56px;margin-bottom:8px;" />
      <h1 style="margin:0;font-size:18px;color:#0f766e;">Consentimiento Informado para Vacunación</h1>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;">${escapeHtml(config.meta.entidadNombre)} · Código ${escapeHtml(config.meta.codigo)} · Versión ${escapeHtml(config.meta.version)}</div>
    </div>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Datos generales</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${kvRows(generalPairs)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección A · Historial de vacunas</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${kvRows(seccionAPairs)}${seccionAQuestions}</table>
    ${antFecha ? `<div style="margin-bottom:16px;font-size:11px;"><strong>Antineumocócica ¿cuándo?:</strong> ${escapeHtml(antFecha)}</div>` : ""}

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección B · Cuestionario sobre salud</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${questionRows(config.seccionB, values)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Vacunas de virus vivos</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${questionRows(config.virusVivos, values)}</table>

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Sección C · Datos de la(s) vacuna(s)</h2>
    ${vaccineTableHtml(config, values["seccionC"] ?? "")}

    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Consentimiento informado</h2>
    <div style="font-size:11px;margin-bottom:14px;">${legalParagraphs}</div>
    <h2 style="font-size:13px;color:#0f766e;margin:0 0 6px;">Habeas Data</h2>
    <div style="font-size:11px;margin-bottom:18px;">${habeasParagraphs}</div>

    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      <tr>
        ${signatureCell(values[SIGNATURE_FIELD_ID] ?? "", config.firmas.firmaPaciente.label)}
        ${signatureCell(values[SIGNATURE_RESP_FIELD_ID] ?? "", config.firmas.firmaResponsable.label)}
      </tr>
    </table>
    <div style="margin-top:10px;font-size:11px;color:#374151;"><strong>Documento:</strong> ${escapeHtml(values[PATIENT_DOC_FIELD_ID] ?? "")}</div>
  </div>`;
}
