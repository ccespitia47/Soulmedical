// Hook de envío del motor de consentimientos config-driven: persiste en la API
// dedicada (`POST /consents`) y, si tiene éxito, genera el PDF y lo envía por
// correo (clínica + paciente). Reproduce el patrón de `useVaccinationConsent`
// (submitting/emailStatus/emailError/done/reset) pero contra `/consents` en
// vez de `addSubmission`, y parametrizado por `ConsentDefinition.meta` en vez
// de una `EntityConfig` fija por entidad.

import { useState } from "react";
import { createConsentApi } from "../../../services/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { sendFormEmail, type EmailAttachment } from "../../../services/emailService";
import { htmlToPdfBase64 } from "../../../utils/pdfExporter";
import type { EmailTemplate } from "../../../types/email-template.types";
import type { EmailStatus } from "../../form/SuccessModal";
import { CLINIC_EMAIL } from "../config/entityConfig";
import { buildCreatePayload, flattenConsent } from "./consentState";
import { buildConsentPdf } from "./buildConsentPdf";
import type { ConsentDefinition, ConsentState } from "./consentDefinition";

// Plantilla de correo: copia a la clínica (estática) + al paciente (grupo
// "current_user", que el backend resuelve con el email presente en formData).
// Parametrizada por `def.meta` en vez de una `EntityConfig` fija.
function buildEmailTemplate(def: ConsentDefinition): EmailTemplate {
  const m = def.meta;
  return {
    enabled: true,
    subject: `Consentimiento ${m.titulo} ${m.displayName} firmado - \${pacienteNombre}`,
    senderName: `${m.displayName} - Consentimientos`,
    to: "",
    toRecipients: [
      { id: "clinic", type: "static", email: CLINIC_EMAIL },
      { id: "patient", type: "group", group: "current_user", groupLabel: "Paciente" },
    ],
    emailBody: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#374151;">
        <h2 style="color:#0f766e;margin:0 0 12px;">Consentimiento ${m.titulo} · ${m.displayName}</h2>
        <p>Se ha registrado y firmado el consentimiento de
        <strong>\${pacienteNombre}</strong> (documento \${pacienteNumDoc}).</p>
        <p>Adjuntamos el consentimiento firmado en formato PDF.</p>
        <p style="color:#9ca3af;font-size:12px;">${m.entidadNombre}</p>
      </div>`,
    attachPDF: true,
    pdfTemplate: "",
    pdfFilename: `consentimiento-${m.tipo}.pdf`,
  };
}

// Datos legibles (sin firmas ni foto: son data URLs enormes) para el cuerpo
// del correo, más los placeholders `pacienteNombre`/`pacienteNumDoc` que usa
// la plantilla. El backend detecta el email del paciente escaneando los
// valores de `formData`, así que basta con conservar el resto de campos tal
// cual vienen en `flat`.
function buildEmailFormData(def: ConsentDefinition, flat: Record<string, string>): Record<string, string> {
  const exclude = new Set<string>();
  for (const section of def.sections) {
    if (section.kind === "signatures") {
      exclude.add(section.firmaPaciente.id);
      if (section.firmaResponsable) exclude.add(section.firmaResponsable.id);
    }
    if (section.kind === "photo") exclude.add(section.photo.id);
  }

  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(flat)) {
    if (!exclude.has(id)) out[id] = value;
  }

  out.pacienteNombre = `${flat.nombres ?? ""} ${flat.apellidos ?? ""}`.trim();
  out.pacienteNumDoc = flat.numDoc ?? "";
  return out;
}

export function useConsentSubmission(def: ConsentDefinition) {
  const currentUser = useAuthStore((s) => s.currentUser);

  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  // Error de PERSISTENCIA (POST /consents), distinto de `emailError`: cuando el
  // registro no llega a guardarse no marcamos `done`, así que el `SuccessModal`
  // (que sí muestra el estado del correo) nunca aparece. Este estado se pinta
  // como banner de error para que el fallo sea visible (spec §11).
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submitConsent(state: ConsentState) {
    if (submitting) return;
    setSubmitting(true);
    setEmailStatus("idle");
    setEmailError(null);
    setSubmitError(null);

    // 1. Persistir el consentimiento en `consent_records` vía la API dedicada.
    const payload = buildCreatePayload(def, state);
    const res = await createConsentApi(payload);

    if (res.error) {
      // El POST falló: exponemos el error de persistencia y NO enviamos correo
      // ni marcamos `done` (nada quedó registrado, la UI debe permitir reintentar).
      setSubmitError(res.error);
      setSubmitting(false);
      return;
    }

    // 2. Generar el PDF y 3. enviarlo por correo (clínica + paciente).
    setEmailStatus("sending");
    try {
      const flat = flattenConsent(def, state);
      const html = buildConsentPdf(def, flat);
      const base64 = await htmlToPdfBase64(html);
      const attachments: EmailAttachment[] = [
        {
          name: `consentimiento-${def.meta.tipo}.pdf`,
          contentType: "application/pdf",
          contentBytes: base64,
        },
      ];

      await sendFormEmail({
        template: buildEmailTemplate(def),
        formData: buildEmailFormData(def, flat),
        users: [],
        currentUser: currentUser ?? undefined,
        attachments,
      });
      setEmailStatus("sent");
    } catch (err) {
      console.error("Error enviando el consentimiento por email:", err);
      setEmailStatus("error");
      setEmailError(err instanceof Error ? err.message : String(err));
    }

    setSubmitting(false);
    setDone(true);
  }

  function reset() {
    setDone(false);
    setEmailStatus("idle");
    setEmailError(null);
    setSubmitError(null);
  }

  return { submitConsent, submitting, emailStatus, emailError, submitError, done, reset };
}
