import { useState } from "react";
import { useSubmissionsStore } from "../../store/useSubmissionsStore";
import { useAuthStore } from "../../store/useAuthStore";
import { sendFormEmail, type EmailAttachment } from "../../services/emailService";
import { htmlToPdfBase64 } from "../../utils/pdfExporter";
import type { EmailTemplate } from "../../types/email-template.types";
import type { EmailStatus } from "../form/SuccessModal";
import { CLINIC_EMAIL, CONSENT_FOLDER_ID, type EntityConfig } from "./config";
import { readableSummary } from "./flattenConsent";
import { buildVaccinationConsentHtml } from "./vaccinationConsentPdf";

// Plantilla de correo: copia a la clínica (estática) + al paciente (grupo
// "current_user", que el backend resuelve con el email presente en formData).
function buildEmailTemplate(config: EntityConfig): EmailTemplate {
  return {
    enabled: true,
    subject: `Consentimiento de vacunación ${config.meta.displayName} firmado - \${pacienteNombre}`,
    senderName: `${config.meta.displayName} - Consentimientos`,
    to: "",
    toRecipients: [
      { id: "clinic", type: "static", email: CLINIC_EMAIL },
      { id: "patient", type: "group", group: "current_user", groupLabel: "Paciente" },
    ],
    emailBody: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#374151;">
        <h2 style="color:#0f766e;margin:0 0 12px;">Consentimiento de vacunación · ${config.meta.displayName}</h2>
        <p>Se ha registrado y firmado el consentimiento de vacunación de
        <strong>\${pacienteNombre}</strong> (documento \${pacienteNumDoc}).</p>
        <p>Adjuntamos el consentimiento firmado en formato PDF.</p>
        <p style="color:#9ca3af;font-size:12px;">${config.meta.entidadNombre}</p>
      </div>`,
    attachPDF: true,
    pdfTemplate: "",
    pdfFilename: `consentimiento-vacunacion-${config.meta.key}.pdf`,
  };
}

export function useVaccinationConsent() {
  const { addSubmission } = useSubmissionsStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // flat: todos los campos aplanados + ambas firmas + aceptaConsentimiento.
  async function submitConsent(config: EntityConfig, flat: Record<string, string>) {
    if (submitting) return;
    setSubmitting(true);
    setEmailStatus("idle");
    setEmailError(null);

    // 1. Persistir el envío. Las firmas (widgets signature) se descargan a
    //    GridFS en el backend. addSubmission no lanza: si el API falla, guarda local.
    await addSubmission({
      formId: config.meta.formId,
      folderId: CONSENT_FOLDER_ID,
      data: flat,
    });

    // 2. Generar el PDF y 3. enviarlo por correo (clínica + paciente).
    setEmailStatus("sending");
    try {
      const html = buildVaccinationConsentHtml(config, flat);
      const base64 = await htmlToPdfBase64(html);
      const attachments: EmailAttachment[] = [
        {
          name: `consentimiento-vacunacion-${config.meta.key}.pdf`,
          contentType: "application/pdf",
          contentBytes: base64,
        },
      ];

      await sendFormEmail({
        template: buildEmailTemplate(config),
        // Resumen sin firmas (data URL enorme); conserva el email del
        // paciente para que el grupo "current_user" lo resuelva.
        formData: readableSummary(config, flat),
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
  }

  return { submitConsent, submitting, emailStatus, emailError, done, reset };
}
