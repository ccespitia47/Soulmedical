import { useEffect, useRef, useState } from "react";
import PdfMapper from "./PdfMapper";
import ExcelMapper from "./ExcelMapper";
import ExcelPreview from "./ExcelPreview";
import type { EmailTemplate } from "../../types/email-template.types";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";
import { useUsersStore } from "../../store/useUsersStore";
import {
  DEFAULT_EMAIL_HTML,
  buildPdfHtmlTemplate,
  renderWithPlaceholders,
} from "../../utils/emailTemplates";
import RecipientsInput from "./emailConfig/RecipientsInput";
import SenderSection from "./emailConfig/SenderSection";
import EmailBodyEditor from "./emailConfig/EmailBodyEditor";
import PdfAttachmentSection from "./emailConfig/PdfAttachmentSection";
import PreviewModal from "./emailConfig/PreviewModal";

type EmailConfigPanelProps = {
  folderId?: string;
  formId?: string;
  onClose: () => void;
};

const INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px]";

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

export default function EmailConfigPanel({ folderId, formId, onClose }: EmailConfigPanelProps) {
  const widgets = useBuilderStore((s) => s.widgets);
  const { folders, updateFormEmailTemplate } = useFolderStore();
  const { users } = useUsersStore();
  const hasLoadedRef = useRef(false);

  const [config, setConfig] = useState<EmailTemplate>(INITIAL_CONFIG);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showEmailCodeMode, setShowEmailCodeMode] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [pdfMode, setPdfMode] = useState<"html" | "upload" | "excel">("html");
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [showPdfMapper, setShowPdfMapper] = useState(false);
  const [showExcelMapper, setShowExcelMapper] = useState(false);
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
          if ((tmpl.ccRecipients?.length ?? 0) > 0 || (tmpl.bccRecipients?.length ?? 0) > 0)
            setShowCcBcc(true);
          hasLoadedRef.current = true;
        }
      }, 0);
    }
  }, [folderId, formId, folders]);

  const widgetPlaceholders = widgets.map((w) => ({
    placeholder: `\${${w.label
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/gi, "")}}`,
    description: w.label,
    widgetType: w.type,
  }));

  const clearErrorContaining = (substr: string) =>
    setValidationErrors((prev) => prev.filter((e) => !e.includes(substr)));

  const handleSave = () => {
    if (!folderId || !formId) return;
    if (config.enabled) {
      const errors: string[] = [];
      if ((config.toRecipients?.length ?? 0) === 0)
        errors.push("Debes agregar al menos un destinatario en Para (To)");
      if (!config.subject?.trim()) errors.push("El asunto no puede estar vacío");
      if (!config.emailBody?.trim()) errors.push("El cuerpo del email no puede estar vacío");
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
    }
    setValidationErrors([]);
    updateFormEmailTemplate(folderId, formId, config);
    onClose();
  };

  const handlePdfUpload = (file: File) => {
    setUploadedPdfFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      setConfig((prev) => ({ ...prev, pdfBase64: reader.result as string, pdfMappings: [] }));
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

  const hasSubjectError = validationErrors.some((e) => e.includes("asunto"));
  const hasBodyError = validationErrors.some((e) => e.includes("cuerpo"));
  const hasToError = validationErrors.some((e) => e.includes("destinatario"));
  const totalTo = config.toRecipients?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[90vh] w-full max-w-[1000px] flex-col rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="m-0 text-xl font-bold text-gray-900">📧 Configuración de Email</h2>
            <p className="mt-1 text-[13px] text-gray-500">
              Configura el email que se enviará al completar el formulario
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-2xl text-gray-400"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <label
            className="mb-6 flex cursor-pointer items-center gap-2.5 rounded-[10px] border-2 p-4"
            style={{
              background: config.enabled ? "#e6faf7" : "#f9fafb",
              borderColor: config.enabled ? "#00c2a8" : "#e2e8f0",
            }}
          >
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, enabled: e.target.checked }));
                setValidationErrors([]);
              }}
              className="h-[18px] w-[18px] cursor-pointer"
            />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Activar notificación por email
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                Se enviará un email automáticamente cuando alguien complete este formulario
              </div>
            </div>
          </label>

          {config.enabled && (
            <>
              <SenderSection
                senderName={config.senderName ?? ""}
                replyTo={config.replyTo ?? ""}
                onChangeSenderName={(v) => setConfig((prev) => ({ ...prev, senderName: v }))}
                onChangeReplyTo={(v) => setConfig((prev) => ({ ...prev, replyTo: v }))}
              />

              <div
                className="mb-6 rounded-xl border-2 bg-slate-50 p-5"
                style={{ borderColor: hasToError ? "#fca5a5" : "#e2e8f0" }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👥</span>
                    <h3 className="m-0 text-[15px] font-bold text-gray-900">Destinatarios</h3>
                    {totalTo > 0 && (
                      <span className="rounded-[20px] bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#00c2a8]">
                        {totalTo} en Para
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="cursor-pointer border-none bg-transparent text-xs font-semibold text-cyan-700"
                  >
                    {showCcBcc ? "▲ Ocultar CC/BCC" : "▼ Mostrar CC/BCC"}
                  </button>
                </div>
                <RecipientsInput
                  label="Para (To) *"
                  recipients={config.toRecipients ?? []}
                  allUsers={users}
                  hasError={hasToError}
                  onChange={(r) => {
                    setConfig((prev) => ({ ...prev, toRecipients: r }));
                    if (r.length > 0) clearErrorContaining("destinatario");
                  }}
                />
                {showCcBcc && (
                  <div className="mt-1 grid grid-cols-2 gap-4">
                    <RecipientsInput
                      label="CC (opcional)"
                      recipients={config.ccRecipients ?? []}
                      allUsers={users}
                      onChange={(r) =>
                        setConfig((prev) => ({ ...prev, ccRecipients: r }))
                      }
                    />
                    <RecipientsInput
                      label="BCC (opcional)"
                      recipients={config.bccRecipients ?? []}
                      allUsers={users}
                      onChange={(r) =>
                        setConfig((prev) => ({ ...prev, bccRecipients: r }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="mb-5">
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase"
                  style={{ color: hasSubjectError ? "#dc2626" : "#6b7280" }}
                >
                  Asunto *
                  {hasSubjectError && (
                    <span className="ml-1 font-normal text-red-600">
                      — No puede estar vacío
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={config.subject}
                  onChange={(e) => {
                    setConfig((prev) => ({ ...prev, subject: e.target.value }));
                    if (e.target.value.trim()) clearErrorContaining("asunto");
                  }}
                  placeholder="Nuevo registro - Formulario"
                  className={INPUT_CLASS}
                  style={
                    hasSubjectError
                      ? { border: "1.5px solid #fca5a5", background: "#fef2f2" }
                      : undefined
                  }
                />
              </div>

              <EmailBodyEditor
                value={config.emailBody}
                codeMode={showEmailCodeMode}
                hasError={hasBodyError}
                placeholders={widgetPlaceholders}
                onChange={(html) => {
                  setConfig((prev) => ({ ...prev, emailBody: html }));
                  if (html.trim()) clearErrorContaining("cuerpo");
                }}
                onToggleCodeMode={() => setShowEmailCodeMode(!showEmailCodeMode)}
                onLoadTemplate={() =>
                  setConfig((prev) => ({ ...prev, emailBody: DEFAULT_EMAIL_HTML }))
                }
                onClear={() => setConfig((prev) => ({ ...prev, emailBody: "" }))}
                onPreview={() => setShowEmailPreview(true)}
              />

              <PdfAttachmentSection
                mode={pdfMode}
                pdfTemplate={config.pdfTemplate}
                pdfBase64={config.pdfBase64}
                pdfMappingsCount={config.pdfMappings?.length ?? 0}
                uploadedPdfFile={uploadedPdfFile}
                excelBase64={config.excelBase64}
                excelFilename={config.excelFilename}
                uploadedExcelFile={uploadedExcelFile}
                excelMappingsCount={config.excelMappings?.length ?? 0}
                placeholders={widgetPlaceholders}
                onChangeMode={setPdfMode}
                onChangePdfTemplate={(v) =>
                  setConfig((prev) => ({ ...prev, pdfTemplate: v }))
                }
                onClearPdfTemplate={() =>
                  setConfig((prev) => ({ ...prev, pdfTemplate: "" }))
                }
                onLoadPdfTemplate={() =>
                  setConfig((prev) => ({
                    ...prev,
                    pdfTemplate: buildPdfHtmlTemplate(widgets),
                  }))
                }
                onPreviewPdf={() => setShowPdfPreview(true)}
                onUploadPdf={handlePdfUpload}
                onOpenPdfMapper={() => setShowPdfMapper(true)}
                onUploadExcel={handleExcelUpload}
                onOpenExcelMapper={() => setShowExcelMapper(true)}
                onPreviewExcel={() => setShowExcelPreview(true)}
              />

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={config.attachPDF}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, attachPDF: e.target.checked }))
                  }
                  className="h-4 w-4 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-gray-900">
                    Adjuntar PDF al email
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    Se generará el PDF y se adjuntará automáticamente
                  </div>
                </div>
              </label>
              {config.attachPDF && (
                <div className="ml-7 mt-3">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Nombre del archivo PDF
                  </label>
                  <input
                    type="text"
                    value={config.pdfFilename}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, pdfFilename: e.target.value }))
                    }
                    placeholder="formulario.pdf"
                    className="w-[300px] rounded-md border-[1.5px] border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {validationErrors.length > 0 && (
          <div className="mx-6 mb-4 rounded-[10px] border-[1.5px] border-red-200 bg-red-50 px-4 py-3">
            <div className="mb-1.5 text-[13px] font-bold text-red-600">
              ⚠️ Corrige los siguientes errores:
            </div>
            <ul className="m-0 pl-4 text-xs leading-7 text-red-900">
              {validationErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2.5 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2.5 text-sm font-semibold text-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-6 py-2.5 text-sm font-semibold text-white"
          >
            💾 Guardar configuración
          </button>
        </div>

        {showEmailPreview && (
          <PreviewModal
            title="📧 Preview - Email"
            html={renderWithPlaceholders(config.emailBody, widgetPlaceholders)}
            onClose={() => setShowEmailPreview(false)}
          />
        )}
        {showPdfPreview && (
          <PreviewModal
            title="📄 Preview - PDF"
            html={renderWithPlaceholders(config.pdfTemplate, widgetPlaceholders)}
            onClose={() => setShowPdfPreview(false)}
          />
        )}
        {showPdfMapper && config.pdfBase64 && (
          <PdfMapper
            pdfBase64={config.pdfBase64}
            existingMappings={config.pdfMappings || []}
            availablePlaceholders={widgetPlaceholders}
            onSave={(mappings) => {
              setConfig((prev) => ({ ...prev, pdfMappings: mappings }));
              setShowPdfMapper(false);
            }}
            onClose={() => setShowPdfMapper(false)}
          />
        )}
        {showExcelMapper && config.excelBase64 && (
          <ExcelMapper
            excelBase64={config.excelBase64}
            existingMappings={config.excelMappings || []}
            availablePlaceholders={widgetPlaceholders}
            onSave={(mappings, logoBase64) => {
              setConfig((prev) => ({
                ...prev,
                excelMappings: mappings,
                ...(logoBase64 ? { excelLogoBase64: logoBase64 } : {}),
              }));
              setShowExcelMapper(false);
            }}
            onClose={() => setShowExcelMapper(false)}
          />
        )}
        {showExcelPreview && config.excelBase64 && (
          <ExcelPreview
            excelBase64={config.excelBase64}
            mappings={config.excelMappings || []}
            availablePlaceholders={widgetPlaceholders}
            customLogoBase64={config.excelLogoBase64}
            onClose={() => setShowExcelPreview(false)}
          />
        )}
      </div>
    </div>
  );
}
