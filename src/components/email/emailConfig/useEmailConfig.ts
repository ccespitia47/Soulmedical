import { useEffect, useRef, useState } from "react";
import type { EmailTemplate } from "../../../types/email-template.types";
import { useFolderStore } from "../../../store/useFolderStore";

const INITIAL_CONFIG: EmailTemplate = {
  enabled: false,
  subject: "",
  to: "",
  cc: "",
  bcc: "",
  replyTo: "",
  emailBody: "",
  attachPDF: true,
  pdfTemplate: "",
  pdfFilename: "formulario.pdf",
  toRecipients: [],
  ccRecipients: [],
  bccRecipients: [],
  senderName: "",
};

export type PdfMode = "html" | "upload" | "excel";

export function useEmailConfig(folderId: string | undefined, formId: string | undefined) {
  const { folders, updateFormEmailTemplate } = useFolderStore();
  const hasLoadedRef = useRef(false);

  const [config, setConfig] = useState<EmailTemplate>(INITIAL_CONFIG);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>("html");
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [uploadedExcelFile, setUploadedExcelFile] = useState<File | null>(null);

  useEffect(() => {
    if (!folderId || !formId || hasLoadedRef.current) return;
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (form?.emailTemplate) {
      setTimeout(() => {
        if (form.emailTemplate) {
          const tmpl = form.emailTemplate;
          setConfig({
            ...tmpl,
            toRecipients: tmpl.toRecipients ?? [],
            ccRecipients: tmpl.ccRecipients ?? [],
            bccRecipients: tmpl.bccRecipients ?? [],
          });
          if (
            (tmpl.ccRecipients?.length ?? 0) > 0 ||
            (tmpl.bccRecipients?.length ?? 0) > 0
          )
            setShowCcBcc(true);
          hasLoadedRef.current = true;
        }
      }, 0);
    }
  }, [folderId, formId, folders]);

  const clearErrorContaining = (substr: string) =>
    setValidationErrors((prev) => prev.filter((e) => !e.includes(substr)));

  const validate = (): boolean => {
    if (!config.enabled) {
      setValidationErrors([]);
      return true;
    }
    const errors: string[] = [];
    if ((config.toRecipients?.length ?? 0) === 0)
      errors.push("Debes agregar al menos un destinatario en Para (To)");
    if (!config.subject?.trim())
      errors.push("El asunto no puede estar vacío");
    if (!config.emailBody?.trim())
      errors.push("El cuerpo del email no puede estar vacío");
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const save = (): boolean => {
    if (!folderId || !formId) return false;
    if (!validate()) return false;
    updateFormEmailTemplate(folderId, formId, config);
    return true;
  };

  const handlePdfUpload = (file: File) => {
    setUploadedPdfFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      setConfig((prev) => ({
        ...prev,
        pdfBase64: reader.result as string,
        pdfMappings: [],
      }));
    reader.readAsDataURL(file);
  };

  const handleExcelUpload = (file: File) => {
    setUploadedExcelFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      setConfig((prev) => ({
        ...prev,
        excelBase64: reader.result as string,
        excelMappings: [],
        excelFilename: file.name,
      }));
    reader.readAsDataURL(file);
  };

  return {
    config,
    setConfig,
    validationErrors,
    setValidationErrors,
    clearErrorContaining,
    showCcBcc,
    setShowCcBcc,
    pdfMode,
    setPdfMode,
    uploadedPdfFile,
    uploadedExcelFile,
    handlePdfUpload,
    handleExcelUpload,
    save,
  };
}
