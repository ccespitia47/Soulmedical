import { useEffect, useRef, useState } from "react";
import { useSubmissionsStore } from "../store/useSubmissionsStore";
import { useFolderStore } from "../store/useFolderStore";
import { useUsersStore } from "../store/useUsersStore";
import { useAuthStore } from "../store/useAuthStore";
import { sendFormEmail, type EmailAttachment } from "../services/emailService";
import { generateExcelHtml } from "../utils/excelToHtml";
import { evaluateRules } from "../utils/formRules";
import { htmlToPdfBase64 } from "../utils/pdfExporter";
import { saveDraft, loadDraft, deleteDraft } from "../utils/formDrafts";
import { expandFormData, renderFilename } from "../utils/placeholders";
import type { FormRule, WidgetInstance } from "../types/widget.types";
import FormHeader from "../components/form/FormHeader";
import FormBody from "../components/form/FormBody";
import MissingFieldsModal from "../components/form/MissingFieldsModal";
import SuccessModal, { type EmailStatus } from "../components/form/SuccessModal";

type FormPageProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  rules?: FormRule[];
  onClose?: () => void;
  isPublic?: boolean;
};

export default function FormPage({
  formId,
  folderId,
  formName,
  widgets,
  rules = [],
  onClose,
  isPublic = false,
}: FormPageProps) {
  const { addSubmission } = useSubmissionsStore();
  const { folders } = useFolderStore();
  const { users, loadUsers, loaded: usersLoaded } = useUsersStore();
  const { currentUser } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!usersLoaded) loadUsers();
  }, [usersLoaded, loadUsers]);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const hiddenWidgetIds = evaluateRules(rules, fieldValues);

  useEffect(() => {
    if (!currentUser?.id) return;
    const draft = loadDraft(currentUser.id, folderId, formId);
    if (!draft) return;
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      for (const [key, value] of Object.entries(draft.values)) {
        const input = form.elements.namedItem(key) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (input && "value" in input) input.value = value;
      }
      setFieldValues(draft.values);
    });
  }, [currentUser?.id, folderId, formId]);

  const handleFormChange = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const values: Record<string, string> = {};
    widgets.forEach((w) => {
      values[w.id] = String(fd.get(w.id) ?? "");
    });
    setFieldValues(values);

    if (currentUser?.id) {
      saveDraft({
        userId: currentUser.id,
        folderId,
        formId,
        formName,
        values,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const formEl = e.target as HTMLFormElement;
    const formData = new FormData(formEl);

    const missing: string[] = [];
    widgets.forEach((widget) => {
      if (widget.required && !hiddenWidgetIds.has(widget.id)) {
        const value = formData.get(widget.id);
        if (!value || (typeof value === "string" && !value.trim()))
          missing.push(widget.label);
      }
    });
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setSubmitting(true);

    const data: Record<string, unknown> = {};
    widgets.forEach((widget) => {
      if (hiddenWidgetIds.has(widget.id)) return;
      const value = formData.get(widget.id);
      if (!value) { data[widget.id] = ""; return; }
      const str = String(value);
      if (str.startsWith("{") || str.startsWith("[")) {
        try { data[widget.id] = JSON.parse(str); return; } catch { /* string */ }
      }
      data[widget.id] = str;
    });

    // ── Capturar nombre sugerido del PDF ────────────────────────────────────
    // El HTML snapshot ya NO se envía desde el cliente — el backend lo deriva
    // de form.emailTemplate.pdfTemplate para prevenir inyección HTML/JS que
    // después se rendería en Puppeteer. Sólo el nombre de archivo cruza el
    // borde de red (validado por regex estricta en el DTO).
    const folder = folders.find((f) => f.id === folderId);
    const formConfig = folder?.forms.find((fm) => fm.id === formId);
    const template = formConfig?.emailTemplate;

    let pdfFilename: string | undefined;

    if (template?.attachPDF && template?.pdfTemplate?.trim()) {
      try {
        const labeledDataForSnapshot = expandFormData(widgets, data, hiddenWidgetIds);
        pdfFilename = renderFilename(template.pdfFilename, labeledDataForSnapshot);
      } catch (e) {
        console.warn("No se pudo derivar el nombre sugerido del PDF:", e);
      }
    }

    addSubmission(
      { formId, folderId, data: data as Record<string, string> },
      pdfFilename,
    );

    if (currentUser?.id) deleteDraft(currentUser.id, folderId, formId);

    if (template?.enabled) {
      setEmailStatus("sending");
      try {
        const labeledData = expandFormData(widgets, data, hiddenWidgetIds);
        const attachments: EmailAttachment[] = [];

        // Excel mapeado → PDF
        if (template.excelBase64 && (template.excelMappings?.length ?? 0) > 0) {
          const html = generateExcelHtml(
            template.excelBase64,
            template.excelMappings!,
            labeledData,
            template.excelLogoBase64,
          );
          if (html) {
            try {
              const base64 = await htmlToPdfBase64(html);
              attachments.push({
                name: template.excelFilename?.replace(/\.xlsx?$/i, ".pdf") ?? "formulario.pdf",
                contentType: "application/pdf",
                contentBytes: base64,
              });
            } catch (e) {
              console.error("Error generando PDF del Excel:", e);
            }
          }
        }

        // HTML template → PDF
        if (template.attachPDF && template.pdfTemplate?.trim()) {
          try {
            const filled = template.pdfTemplate.replace(
              /\$\{([^}]+)\}/g,
              (_, key) => {
                const raw = labeledData[key] ?? "";
                if (raw.startsWith("data:image/")) {
                  return `<img src="${raw}" style="max-height:80px;max-width:100%;object-fit:contain;display:block;">`;
                }
                return raw;
              },
            );
            const base64 = await htmlToPdfBase64(filled);
            attachments.push({
              name: renderFilename(template.pdfFilename, labeledData),
              contentType: "application/pdf",
              contentBytes: base64,
            });
          } catch (e) {
            console.error("Error generando PDF del template HTML:", e);
          }
        }

        await sendFormEmail({
          template,
          formData: labeledData,
          users,
          currentUser: currentUser ?? undefined,
          attachments,
        });
        setEmailStatus("sent");
      } catch (err) {
        console.error("Error enviando email:", err);
        setEmailStatus("error");
        setEmailError(err instanceof Error ? err.message : String(err));
      }
    }

    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setFieldValues({});
    setEmailStatus("idle");
    setEmailError(null);
    formRef.current?.reset();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8] font-sans">
      {!isPublic && <FormHeader formName={formName} onClose={onClose} />}
      <FormBody
        ref={formRef}
        formName={formName}
        widgets={widgets}
        hiddenWidgetIds={hiddenWidgetIds}
        submitting={submitting}
        onSubmit={handleSubmit}
        onChange={handleFormChange}
        onCancel={onClose}
      />
      {missingFields.length > 0 && (
        <MissingFieldsModal fields={missingFields} onClose={() => setMissingFields([])} />
      )}
      {showSuccess && (
        <SuccessModal
          emailStatus={emailStatus}
          emailError={emailError}
          onNewRegistration={handleCloseSuccess}
          onClose={onClose}
        />
      )}
    </div>
  );
}