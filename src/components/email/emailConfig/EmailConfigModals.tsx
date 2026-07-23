import PdfMapper from "../PdfMapper";
import ExcelMapper from "../ExcelMapper";
import ExcelPreview from "../ExcelPreview";
import PreviewModal from "./PreviewModal";
import type { EmailTemplate } from "../../../types/email-template.types";
import { renderWithPlaceholders } from "../../../utils/emailTemplates";

type Placeholder = {
  placeholder: string;
  description: string;
  widgetType: string;
};

type EmailConfigModalsProps = {
  config: EmailTemplate;
  setConfig: (updater: (prev: EmailTemplate) => EmailTemplate) => void;
  placeholders: Placeholder[];
  showEmailPreview: boolean;
  showPdfPreview: boolean;
  showPdfMapper: boolean;
  showExcelMapper: boolean;
  showExcelPreview: boolean;
  onCloseEmailPreview: () => void;
  onClosePdfPreview: () => void;
  onClosePdfMapper: () => void;
  onCloseExcelMapper: () => void;
  onCloseExcelPreview: () => void;
};

export default function EmailConfigModals({
  config,
  setConfig,
  placeholders,
  showEmailPreview,
  showPdfPreview,
  showPdfMapper,
  showExcelMapper,
  showExcelPreview,
  onCloseEmailPreview,
  onClosePdfPreview,
  onClosePdfMapper,
  onCloseExcelMapper,
  onCloseExcelPreview,
}: EmailConfigModalsProps) {
  return (
    <>
      {showEmailPreview && (
        <PreviewModal
          title="📧 Preview - Email"
          html={renderWithPlaceholders(config.emailBody, placeholders)}
          onClose={onCloseEmailPreview}
        />
      )}
      {showPdfPreview && (
        <PreviewModal
          title="📄 Preview - PDF"
          html={renderWithPlaceholders(config.pdfTemplate, placeholders)}
          onClose={onClosePdfPreview}
        />
      )}
      {showPdfMapper && config.pdfBase64 && (
        <PdfMapper
          pdfBase64={config.pdfBase64}
          existingMappings={config.pdfMappings || []}
          availablePlaceholders={placeholders}
          onSave={(mappings) => {
            setConfig((prev) => ({ ...prev, pdfMappings: mappings }));
            onClosePdfMapper();
          }}
          onClose={onClosePdfMapper}
        />
      )}
      {showExcelMapper && config.excelBase64 && (
        <ExcelMapper
          excelBase64={config.excelBase64}
          existingMappings={config.excelMappings || []}
          availablePlaceholders={placeholders}
          onSave={(mappings, logoBase64) => {
            setConfig((prev) => ({
              ...prev,
              excelMappings: mappings,
              ...(logoBase64 ? { excelLogoBase64: logoBase64 } : {}),
            }));
            onCloseExcelMapper();
          }}
          onClose={onCloseExcelMapper}
        />
      )}
      {showExcelPreview && config.excelBase64 && (
        <ExcelPreview
          excelBase64={config.excelBase64}
          mappings={config.excelMappings || []}
          availablePlaceholders={placeholders}
          customLogoBase64={config.excelLogoBase64}
          onClose={onCloseExcelPreview}
        />
      )}
    </>
  );
}
