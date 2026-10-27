import { useState } from "react";
import type { AppUser } from "../../../store/useUsersStore";
import type { EmailTemplate } from "../../../types/email-template.types";
import type { WidgetInstance } from "../../../types/widget.types";
import {
  DEFAULT_EMAIL_HTML,
  buildPdfHtmlTemplate,
} from "../../../utils/emailTemplates";
import HtmlCellMapper from "../HtmlCellMapper";
import SenderSection from "./SenderSection";
import EmailBodyEditor from "./EmailBodyEditor";
import PdfAttachmentSection from "./PdfAttachmentSection";
import RecipientsSection from "./RecipientsSection";
import SubjectField from "./SubjectField";
import AttachPdfToggle from "./AttachPdfToggle";
import ValidationErrorsBox from "./ValidationErrorsBox";
import EmailConfigModals from "./EmailConfigModals";
import Icon from "../../common/Icon";
import type { PdfMode } from "./useEmailConfig";

type Placeholder = {
  placeholder: string;
  description: string;
  widgetType: string;
};

type EmailFieldOption = { id: string; label: string };

export type EmailConfigItemProps = {
  config: EmailTemplate;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (partial: Partial<EmailTemplate>) => void;
  onReplace: (updater: (prev: EmailTemplate) => EmailTemplate) => void;
  onDelete: () => void;
  widgets: WidgetInstance[];
  users: AppUser[];
  emailFields: EmailFieldOption[];
  widgetPlaceholders: Placeholder[];
  validationErrors: string[];
  clearErrorContaining: (substr: string) => void;
};

export default function EmailConfigItem({
  config,
  index,
  total,
  expanded,
  onToggleExpanded,
  onChange,
  onReplace,
  onDelete,
  widgets,
  users,
  emailFields,
  widgetPlaceholders,
  validationErrors,
  clearErrorContaining,
}: EmailConfigItemProps) {
  // Estado transitorio de UI local a esta notificación (modales,
  // modo del editor, etc.). No se persiste; vive mientras el panel
  // está abierto.
  const [showCcBcc, setShowCcBcc] = useState(
    (config.ccRecipients?.length ?? 0) > 0 ||
      (config.bccRecipients?.length ?? 0) > 0,
  );
  const [pdfMode, setPdfMode] = useState<PdfMode>("html");
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [uploadedExcelFile, setUploadedExcelFile] = useState<File | null>(null);
  const [showEmailCodeMode, setShowEmailCodeMode] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [showPdfMapper, setShowPdfMapper] = useState(false);
  const [showExcelMapper, setShowExcelMapper] = useState(false);
  const [showHtmlMapper, setShowHtmlMapper] = useState(false);

  const handlePdfUpload = (file: File) => {
    setUploadedPdfFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      onChange({
        pdfBase64: reader.result as string,
        pdfMappings: [],
      });
    reader.readAsDataURL(file);
  };

  const handleExcelUpload = (file: File) => {
    setUploadedExcelFile(file);
    const reader = new FileReader();
    reader.onload = () =>
      onChange({
        excelBase64: reader.result as string,
        excelMappings: [],
        excelFilename: file.name,
      });
    reader.readAsDataURL(file);
  };

  const hasSubjectError = validationErrors.some((e) => e.includes("asunto"));
  const hasBodyError = validationErrors.some((e) => e.includes("cuerpo"));
  const hasToError = validationErrors.some((e) => e.includes("destinatario"));

  const title =
    (config.label?.trim() ||
      (config.subject?.trim() ? config.subject.trim() : "")) ||
    `Notificación ${index + 1}`;

  const toCount = config.toRecipients?.length ?? 0;

  return (
    <div
      className="rounded-xl border-2 bg-white"
      style={{
        borderColor:
          validationErrors.length > 0 ? "#fca5a5" : config.enabled ? "#bbf7d0" : "#e2e8f0",
      }}
    >
      {/* Header del acordeón: título, estado, chevron, papelera */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex flex-1 min-w-0 cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-left"
        >
          <span
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            style={{
              background: config.enabled
                ? "linear-gradient(135deg,#00c2a8 0%,#0891b2 100%)"
                : "#94a3b8",
            }}
          >
            <Icon name="chevronRight" size={14} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-slate-900">
              {title}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {config.enabled ? "Activa" : "Inactiva"}
              {toCount > 0 && ` · ${toCount} destinatario${toCount > 1 ? "s" : ""}`}
              {config.attachPDF && " · PDF adjunto"}
            </div>
          </div>
        </button>

        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="peer sr-only"
          />
          <span className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#00c2a8]">
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        {total > 1 && (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar esta notificación"
            className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      {expanded && config.enabled && (
        <div className="border-t border-slate-200 px-4 py-4">
          {/* Label visible interno — ayuda a distinguir configs en el panel */}
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Nombre de esta notificación
            </label>
            <input
              type="text"
              value={config.label ?? ""}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Ej: Operaciones, Aseguradora, Cliente…"
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#00c2a8]"
            />
          </div>

          <SenderSection
            senderName={config.senderName ?? ""}
            replyTo={config.replyTo ?? ""}
            onChangeSenderName={(v) => onChange({ senderName: v })}
            onChangeReplyTo={(v) => onChange({ replyTo: v })}
          />

          <RecipientsSection
            toRecipients={config.toRecipients ?? []}
            ccRecipients={config.ccRecipients ?? []}
            bccRecipients={config.bccRecipients ?? []}
            allUsers={users}
            emailFields={emailFields}
            widgets={widgets}
            hasToError={hasToError}
            showCcBcc={showCcBcc}
            onToggleCcBcc={() => setShowCcBcc(!showCcBcc)}
            onChangeTo={(r) => {
              onChange({ toRecipients: r });
              if (r.length > 0) clearErrorContaining("destinatario");
            }}
            onChangeCc={(r) => onChange({ ccRecipients: r })}
            onChangeBcc={(r) => onChange({ bccRecipients: r })}
          />

          <SubjectField
            value={config.subject}
            hasError={hasSubjectError}
            placeholders={widgetPlaceholders}
            onChange={(v) => {
              onChange({ subject: v });
              if (v.trim()) clearErrorContaining("asunto");
            }}
          />

          <EmailBodyEditor
            value={config.emailBody}
            codeMode={showEmailCodeMode}
            hasError={hasBodyError}
            placeholders={widgetPlaceholders}
            onChange={(html) => {
              onChange({ emailBody: html });
              if (html.trim()) clearErrorContaining("cuerpo");
            }}
            onToggleCodeMode={() => setShowEmailCodeMode(!showEmailCodeMode)}
            onLoadTemplate={() => onChange({ emailBody: DEFAULT_EMAIL_HTML })}
            onClear={() => onChange({ emailBody: "" })}
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
            onChangePdfTemplate={(v) => onChange({ pdfTemplate: v })}
            onClearPdfTemplate={() => onChange({ pdfTemplate: "" })}
            onLoadPdfTemplate={() =>
              onChange({ pdfTemplate: buildPdfHtmlTemplate(widgets) })
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
            onChangeAttach={(v) => onChange({ attachPDF: v })}
            onChangeFilename={(v) => onChange({ pdfFilename: v })}
          />

          <ValidationErrorsBox errors={validationErrors} />

          <EmailConfigModals
            config={config}
            setConfig={onReplace}
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
              onSave={(nextHtml) => onChange({ pdfTemplate: nextHtml })}
              onClose={() => setShowHtmlMapper(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
