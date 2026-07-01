import { useEffect, useRef, useState } from "react";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";
import {
  parseExcelForPreview,
  type PreviewCellData,
} from "../../utils/excelPreviewParser";
import { exportElementToPdf } from "../../utils/pdfExporter";
import PreviewHeader from "./excelPreview/PreviewHeader";
import PreviewTable from "./excelPreview/PreviewTable";
import PreviewFooter from "./excelPreview/PreviewFooter";

type PlaceholderItem = {
  placeholder: string;
  description: string;
};

type ExcelPreviewProps = {
  excelBase64: string;
  mappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  customLogoBase64?: string;
  formValues?: Record<string, string>;
  onClose: () => void;
};

export default function ExcelPreview({
  excelBase64,
  mappings,
  availablePlaceholders,
  customLogoBase64,
  formValues,
  onClose,
}: ExcelPreviewProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<PreviewCellData[][]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valueMap = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      const parsed = parseExcelForPreview(excelBase64);
      setRows(parsed.rows);
      setColWidths(parsed.colWidths);
      setRowHeights(parsed.rowHeights);

      const vm: Record<string, string> = {};
      for (const p of availablePlaceholders) {
        vm[p.placeholder] =
          formValues && formValues[p.placeholder] !== undefined
            ? formValues[p.placeholder]
            : `[${p.description}]`;
      }
      valueMap.current = vm;
    } catch (e) {
      setError("No se pudo cargar el Excel para la vista previa.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [excelBase64, mappings, availablePlaceholders, formValues]);

  const resolveValue = (coord: string, originalValue: string): string => {
    const mapping = mappings.find((m) => m.coord === coord);
    if (!mapping) return originalValue;
    return valueMap.current[mapping.placeholder] ?? originalValue;
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(tableRef.current, "formulario.pdf");
    } catch (e) {
      alert("Error al generar el PDF. Intenta de nuevo.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-[4px]">
      <div className="flex max-h-[95vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
        <PreviewHeader
          hasFormValues={!!formValues}
          exporting={exporting}
          loading={loading}
          onExportPdf={handleExportPDF}
          onClose={onClose}
        />

        <div className="flex flex-1 justify-center overflow-auto bg-slate-100 p-6">
          {loading && (
            <div className="flex w-full items-center justify-center gap-2 text-slate-500">
              ⏳ Cargando vista previa...
            </div>
          )}
          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-red-600">
              ❌ {error}
            </div>
          )}
          {!loading && !error && (
            <PreviewTable
              ref={tableRef}
              rows={rows}
              colWidths={colWidths}
              rowHeights={rowHeights}
              mappings={mappings}
              customLogoBase64={customLogoBase64}
              isReal={!!formValues}
              resolveValue={resolveValue}
            />
          )}
        </div>

        <PreviewFooter hasFormValues={!!formValues} />
      </div>
    </div>
  );
}
