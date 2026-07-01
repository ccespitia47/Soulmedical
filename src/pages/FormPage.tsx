import { useRef, useState } from "react";
import { useSubmissionsStore } from "../store/useSubmissionsStore";
import { useRulesStore } from "../store/useRulesStore";
import { useFolderStore } from "../store/useFolderStore";
import { useUsersStore } from "../store/useUsersStore";
import { useAuthStore } from "../store/useAuthStore";
import { sendFormEmail } from "../services/emailService";
import { generateExcelHtml } from "../utils/excelToHtml";
import { evaluateRules } from "../utils/formRules";
import type { WidgetInstance } from "../types/widget.types";
import FormHeader from "../components/form/FormHeader";
import FormBody from "../components/form/FormBody";
import MissingFieldsModal from "../components/form/MissingFieldsModal";
import SuccessModal, { type EmailStatus } from "../components/form/SuccessModal";

type FormPageProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  onClose?: () => void;
  isPublic?: boolean;
};

export default function FormPage({
  formId,
  folderId,
  formName,
  widgets,
  onClose,
  isPublic = false,
}: FormPageProps) {
  const { addSubmission } = useSubmissionsStore();
  const { getRules } = useRulesStore();
  const { folders } = useFolderStore();
  const { users } = useUsersStore();
  const { currentUser } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const rules = getRules(formId);
  const hiddenWidgetIds = evaluateRules(rules, fieldValues);

  const handleFormChange = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const values: Record<string, string> = {};
    widgets.forEach((w) => {
      values[w.id] = String(fd.get(w.id) ?? "");
    });
    setFieldValues(values);
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
      if (!value) {
        data[widget.id] = "";
        return;
      }
      const str = String(value);
      if (str.startsWith("{") || str.startsWith("[")) {
        try {
          data[widget.id] = JSON.parse(str);
          return;
        } catch {
          /* usar como string */
        }
      }
      data[widget.id] = str;
    });

    addSubmission({ formId, folderId, data: data as Record<string, string> });

    const folder = folders.find((f) => f.id === folderId);
    const formConfig = folder?.forms.find((fm) => fm.id === formId);
    const template = formConfig?.emailTemplate;

    if (template?.enabled) {
      setEmailStatus("sending");
      try {
        const labeledData: Record<string, string> = {};
        widgets.forEach((widget) => {
          if (!hiddenWidgetIds.has(widget.id)) {
            const key = widget.label
              .toLowerCase()
              .replace(/\s+/g, "")
              .replace(/[^a-z0-9]/gi, "");
            const val = data[widget.id];
            labeledData[key] =
              val == null
                ? ""
                : typeof val === "string"
                ? val
                : JSON.stringify(val);
          }
        });

        let excelHtml: string | undefined;
        if (
          template.attachPDF &&
          template.excelBase64 &&
          (template.excelMappings?.length ?? 0) > 0
        ) {
          const html = generateExcelHtml(
            template.excelBase64,
            template.excelMappings!,
            labeledData,
            template.excelLogoBase64
          );
          if (html) excelHtml = html;
        }

        await sendFormEmail({
          template,
          formData: labeledData,
          users,
          currentUser: currentUser ?? undefined,
          attachments: [],
          excelHtml,
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
        <MissingFieldsModal
          fields={missingFields}
          onClose={() => setMissingFields([])}
        />
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
