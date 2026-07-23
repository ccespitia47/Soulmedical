import { useEffect, useState } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useUsersStore } from "../../store/useUsersStore";
import {
  DEFAULT_EMAIL_HTML,
  buildPdfHtmlTemplate,
} from "../../utils/emailTemplates";
import SenderSection from "./emailConfig/SenderSection";
import EmailBodyEditor from "./emailConfig/EmailBodyEditor";
import PdfAttachmentSection from "./emailConfig/PdfAttachmentSection";
import EnabledToggle from "./emailConfig/EnabledToggle";
import RecipientsSection from "./emailConfig/RecipientsSection";
import SubjectField from "./emailConfig/SubjectField";
import AttachPdfToggle from "./emailConfig/AttachPdfToggle";
import ValidationErrorsBox from "./emailConfig/ValidationErrorsBox";
import EmailConfigModals from "./emailConfig/EmailConfigModals";
import HtmlCellMapper from "./HtmlCellMapper";
import { useEmailConfig } from "./emailConfig/useEmailConfig";
import { buildPlaceholders } from "../../utils/placeholders";

type EmailConfigPanelProps = {
  folderId?: string;
  formId?: string;
  onClose: () => void;
};

export default function EmailConfigPanel({
  folderId,
  formId,
  onClose,
}: EmailConfigPanelProps) {
  const widgets = useBuilderStore((s) => s.widgets);
  const { users, loadUsers, loaded: usersLoaded } = useUsersStore();
  useEffect(() => {
    if (!usersLoaded) loadUsers();
  }, [usersLoaded, loadUsers]);
  const {
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
  } = useEmailConfig(folderId, formId);

  const [showEmailCodeMode, setShowEmailCodeMode] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [showPdfMapper, setShowPdfMapper] = useState(false);
  const [showExcelMapper, setShowExcelMapper] = useState(false);
  const [showHtmlMapper, setShowHtmlMapper] = useState(false);

  // Genera placeholders para todos los widgets. Para subformularios añade
  // entradas adicionales por cada campo interno y una para la tabla completa
  // — así el usuario puede mapear los datos dentro del subform al PDF/email.
  const widgetPlaceholders = buildPlaceholders(widgets);

  const hasSubjectError = validationErrors.some((e) => e.includes("asunto"));
  const hasBodyError = validationErrors.some((e) => e.includes("cuerpo"));
  const hasToError = validationErrors.some((e) => e.includes("destinatario"));

  const handleSave = () => {
    if (save()) onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[90vh] w-full max-w-[1000px] flex-col rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="m-0 text-xl font-bold text-gray-900">
              📧 Configuración de Email
            </h2>
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
          <EnabledToggle
            enabled={config.enabled}
            onChange={(enabled) => {
              setConfig((prev) => ({ ...prev, enabled }));
              setValidationErrors([]);
            }}
          />

          {config.enabled && (
            <>
              <SenderSection
                senderName={config.senderName ?? ""}
                replyTo={config.replyTo ?? ""}
                onChangeSenderName={(v) =>
                  setConfig((prev) => ({ ...prev, senderName: v }))
                }
                onChangeReplyTo={(v) =>
                  setConfig((prev) => ({ ...prev, replyTo: v }))
                }
              />

              <RecipientsSection
                toRecipients={config.toRecipients ?? []}
                ccRecipients={config.ccRecipients ?? []}
                bccRecipients={config.bccRecipients ?? []}
                allUsers={users}
                hasToError={hasToError}
                showCcBcc={showCcBcc}
                onToggleCcBcc={() => setShowCcBcc(!showCcBcc)}
                onChangeTo={(r) => {
                  setConfig((prev) => ({ ...prev, toRecipients: r }));
                  if (r.length > 0) clearErrorContaining("destinatario");
                }}
                onChangeCc={(r) =>
                  setConfig((prev) => ({ ...prev, ccRecipients: r }))
                }
                onChangeBcc={(r) =>
                  setConfig((prev) => ({ ...prev, bccRecipients: r }))
                }
              />

              <SubjectField
                value={config.subject}
                hasError={hasSubjectError}
                placeholders={widgetPlaceholders}
                onChange={(v) => {
                  setConfig((prev) => ({ ...prev, subject: v }));
                  if (v.trim()) clearErrorContaining("asunto");
                }}
              />

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
                onOpenHtmlMapper={() => setShowHtmlMapper(true)}
              />

              <AttachPdfToggle
                attachPDF={config.attachPDF}
                pdfFilename={config.pdfFilename}
                placeholders={widgetPlaceholders}
                onChangeAttach={(v) =>
                  setConfig((prev) => ({ ...prev, attachPDF: v }))
                }
                onChangeFilename={(v) =>
                  setConfig((prev) => ({ ...prev, pdfFilename: v }))
                }
              />
            </>
          )}
        </div>

        <ValidationErrorsBox errors={validationErrors} />

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

        <EmailConfigModals
          config={config}
          setConfig={setConfig}
          placeholders={widgetPlaceholders}
          showEmailPreview={showEmailPreview}
          showPdfPreview={showPdfPreview}
          showPdfMapper={showPdfMapper}
          showExcelMapper={showExcelMapper}
          showExcelPreview={showExcelPreview}
          onCloseEmailPreview={() => setShowEmailPreview(false)}
          onClosePdfPreview={() => setShowPdfPreview(false)}
          onClosePdfMapper={() => setShowPdfMapper(false)}
          onCloseExcelMapper={() => setShowExcelMapper(false)}
          onCloseExcelPreview={() => setShowExcelPreview(false)}
        />

        {showHtmlMapper && (
          <HtmlCellMapper
            html={config.pdfTemplate}
            placeholders={widgetPlaceholders}
            onSave={(nextHtml) =>
              setConfig((prev) => ({ ...prev, pdfTemplate: nextHtml }))
            }
            onClose={() => setShowHtmlMapper(false)}
          />
        )}
      </div>
    </div>
  );
}
