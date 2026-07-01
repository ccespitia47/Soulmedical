import { useRef } from "react";
import PlaceholderPanel from "./PlaceholderPanel";

type Placeholder = { placeholder: string; description: string };
type PdfMode = "html" | "upload" | "excel";

type PdfAttachmentSectionProps = {
  mode: PdfMode;
  pdfTemplate: string;
  pdfBase64?: string;
  pdfMappingsCount: number;
  uploadedPdfFile: File | null;
  excelBase64?: string;
  excelFilename?: string;
  uploadedExcelFile: File | null;
  excelMappingsCount: number;
  placeholders: Placeholder[];
  onChangeMode: (m: PdfMode) => void;
  onChangePdfTemplate: (v: string) => void;
  onClearPdfTemplate: () => void;
  onLoadPdfTemplate: () => void;
  onPreviewPdf: () => void;
  onUploadPdf: (file: File) => void;
  onOpenPdfMapper: () => void;
  onUploadExcel: (file: File) => void;
  onOpenExcelMapper: () => void;
  onPreviewExcel: () => void;
};

const BTN_BASE = "cursor-pointer rounded-md border-none px-3 py-1 text-[11px] font-semibold";

export default function PdfAttachmentSection({
  mode,
  pdfTemplate,
  pdfBase64,
  pdfMappingsCount,
  uploadedPdfFile,
  excelBase64,
  excelFilename,
  uploadedExcelFile,
  excelMappingsCount,
  placeholders,
  onChangeMode,
  onChangePdfTemplate,
  onClearPdfTemplate,
  onLoadPdfTemplate,
  onPreviewPdf,
  onUploadPdf,
  onOpenPdfMapper,
  onUploadExcel,
  onOpenExcelMapper,
  onPreviewExcel,
}: PdfAttachmentSectionProps) {
  const pdfTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);

  const insertPlaceholder = (p: string) => {
    const ta = pdfTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = pdfTemplate.substring(0, start) + p + pdfTemplate.substring(end);
    onChangePdfTemplate(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + p.length, start + p.length);
    }, 0);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") onUploadPdf(file);
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (
      file &&
      (file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel")
    )
      onUploadExcel(file);
  };

  return (
    <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <h3 className="m-0 text-[15px] font-bold text-gray-900">
            Documento PDF Adjunto
          </h3>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(["html", "upload", "excel"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMode(m)}
              className="cursor-pointer rounded-md border-none px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: mode === m ? "#dc2626" : "transparent",
                color: mode === m ? "#fff" : "#6b7280",
              }}
            >
              {m === "html" ? "💻 HTML" : m === "upload" ? "📤 PDF" : "📊 Excel"}
            </button>
          ))}
        </div>
      </div>

      {mode === "html" && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Este HTML se convertirá en PDF adjunto al email. Usa los placeholders para insertar
            datos del formulario.
          </p>
          <div className="mb-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onLoadPdfTemplate}
              className={`${BTN_BASE} bg-blue-500 text-white`}
            >
              📄 Cargar plantilla
            </button>
            {pdfTemplate && (
              <button
                type="button"
                onClick={onClearPdfTemplate}
                className={`${BTN_BASE} border border-red-200 bg-red-50 text-red-500`}
              >
                🗑️ Borrar plantilla
              </button>
            )}
            <button
              type="button"
              onClick={onPreviewPdf}
              className={`${BTN_BASE} bg-violet-500 text-white`}
            >
              👁️ Preview
            </button>
          </div>
          <PlaceholderPanel placeholders={placeholders} onInsert={insertPlaceholder} />
          <textarea
            ref={pdfTextareaRef}
            value={pdfTemplate}
            onChange={(e) => onChangePdfTemplate(e.target.value)}
            placeholder="<table><tr><td>Nombre: ${nombre}</td></tr></table>"
            className="box-border min-h-[280px] w-full resize-y rounded-lg border-[1.5px] border-slate-200 bg-slate-800 p-3 font-mono text-xs text-slate-200"
          />
        </>
      )}

      {mode === "upload" && (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Sube un archivo PDF que se adjuntará directamente al email
          </p>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <input
              ref={pdfFileRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfChange}
              className="hidden"
            />
            {uploadedPdfFile ? (
              <div>
                <div className="mb-3 text-5xl">✅</div>
                <div className="mb-1 text-sm font-semibold text-gray-900">
                  {uploadedPdfFile.name}
                </div>
                <div className="mb-4 text-xs text-gray-500">
                  {(uploadedPdfFile.size / 1024).toFixed(2)} KB
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => pdfFileRef.current?.click()}
                    className="cursor-pointer rounded-lg border-none bg-red-600 px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    🔄 Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPdfMapper}
                    disabled={!pdfBase64}
                    className="cursor-pointer rounded-lg border-none px-4 py-2 text-[13px] font-semibold disabled:cursor-not-allowed"
                    style={{
                      background: pdfBase64 ? "#00c2a8" : "#e2e8f0",
                      color: pdfBase64 ? "#fff" : "#9ca3af",
                    }}
                  >
                    📍 Mapear ({pdfMappingsCount})
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 text-5xl">📄</div>
                <button
                  type="button"
                  onClick={() => pdfFileRef.current?.click()}
                  className="mt-3 cursor-pointer rounded-lg border-none bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  📤 Seleccionar PDF
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {mode === "excel" && (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Carga un archivo Excel y mapea los campos a celdas específicas
          </p>
          <input
            ref={excelFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelChange}
            className="hidden"
          />
          <div className="mb-4 rounded-xl border-2 border-dashed border-slate-200 bg-gray-50 px-5 py-7 text-center">
            {excelBase64 ? (
              <div>
                <div className="mb-3 text-5xl">📊</div>
                <div className="mb-2 text-sm font-semibold text-[#00c2a8]">
                  ✓ {excelFilename || uploadedExcelFile?.name}
                </div>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => excelFileRef.current?.click()}
                    className="cursor-pointer rounded-lg border-none bg-gray-500 px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    🔄 Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={onOpenExcelMapper}
                    className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    📍 Mapear ({excelMappingsCount})
                  </button>
                  <button
                    type="button"
                    onClick={onPreviewExcel}
                    className="cursor-pointer rounded-lg border-none bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    👁️ Preview
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 text-5xl">📊</div>
                <button
                  type="button"
                  onClick={() => excelFileRef.current?.click()}
                  className="mt-3 cursor-pointer rounded-lg border-none bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  📊 Seleccionar Excel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
