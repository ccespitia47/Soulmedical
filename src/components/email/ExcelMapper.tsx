import { useCallback, useEffect, useState } from "react";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";
import { extractImages, type EmbeddedImage } from "../../utils/excelParser";
import { fetchExcelPreview, editExcelCells } from "../../services/excelPreview";
import ExcelMapperHeader from "./excelMapper/ExcelMapperHeader";
import LogoUploader from "./excelMapper/LogoUploader";
import PlaceholdersList, {
  PlaceholderInstruction,
  type PlaceholderItem,
} from "./excelMapper/PlaceholdersList";
import ExcelHtmlTable from "./excelMapper/ExcelHtmlTable";
import ExcelMapperFooter from "./excelMapper/ExcelMapperFooter";

export type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";

type ExcelMapperProps = {
  excelBase64: string;
  existingMappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  /** `newExcelBase64` llega sólo si el admin editó texto de celdas en el
   *  mapper; en ese caso el caller debe persistirlo en `config.excelBase64`
   *  para que las ediciones queden guardadas. */
  onSave: (
    mappings: ExcelMapping[],
    logoBase64?: string,
    newExcelBase64?: string,
  ) => void;
  onClose: () => void;
};

export default function ExcelMapper({
  excelBase64,
  existingMappings,
  availablePlaceholders,
  onSave,
  onClose,
}: ExcelMapperProps) {
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewCss, setPreviewCss] = useState<string>("");
  const [mappings, setMappings] = useState<Record<string, ExcelMapping>>({});
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderItem | null>(null);
  const [, setEmbeddedImages] = useState<EmbeddedImage[]>([]);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // XLSX "actual": empieza igual al prop y se actualiza con cada edición
  // de texto. Al guardar, si cambió respecto al original, se devuelve en
  // onSave para que el caller lo persista en config.excelBase64.
  const [currentExcelBase64, setCurrentExcelBase64] = useState<string>(excelBase64);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      // Preload los mappings existentes para dibujarlos apenas llegue el HTML.
      const map: Record<string, ExcelMapping> = {};
      for (const m of existingMappings) map[m.coord] = m;
      setMappings(map);

      // La conversión LibreOffice → HTML se hace en el backend y puede
      // tardar 2-5s la primera vez (spawn del proceso). Después cachea.
      const result = await fetchExcelPreview(excelBase64);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setPreviewHtml(result.html);
      setPreviewCss(result.css);

      // Imágenes embebidas del .xlsx — las usa el LogoUploader para saber
      // dónde colocar el logo custom (misma lógica de antes).
      setEmbeddedImages(await extractImages(excelBase64));
      setLoading(false);
    };
    load();
  }, [excelBase64, existingMappings]);

  /**
   * Edita el texto de UNA celda. Llama al backend (exceljs vía
   * /forms/excel/edit-cells), actualiza el XLSX actual + refresca el
   * preview HTML/CSS con la respuesta. No toca mappings ni formato.
   */
  const handleCellEdit = useCallback(
    async (coord: string, newText: string) => {
      // Protección: no permitir editar celdas ya mapeadas (su contenido
      // es un badge que no corresponde al texto real del Excel). El admin
      // debe quitar el mapping primero si quiere cambiar el texto.
      if (mappings[coord]) return;
      setEditing(true);
      setError(null);
      const result = await editExcelCells(currentExcelBase64, { [coord]: newText });
      setEditing(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.excelBase64) setCurrentExcelBase64(result.excelBase64);
      if (result.html !== undefined) setPreviewHtml(result.html);
      if (result.css !== undefined) setPreviewCss(result.css);
    },
    [currentExcelBase64, mappings],
  );

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCustomLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCellClick = useCallback(
    (coord: string, isMappable: boolean) => {
      if (!isMappable || !selectedPlaceholder) return;
      // Si esta celda ya estaba mapeada, ignoramos — el usuario usa el
      // botón ✕ del badge para quitar.
      if (mappings[coord]) return;
      setMappings((prev) => ({
        ...prev,
        [coord]: {
          coord,
          placeholder: selectedPlaceholder.placeholder,
          description: selectedPlaceholder.description,
        },
      }));
      const idx = availablePlaceholders.indexOf(selectedPlaceholder);
      if (idx >= 0 && idx < availablePlaceholders.length - 1) {
        setSelectedPlaceholder(availablePlaceholders[idx + 1]);
      }
    },
    [availablePlaceholders, mappings, selectedPlaceholder],
  );

  const removeMapping = useCallback((coord: string) => {
    setMappings((prev) => {
      const c = { ...prev };
      delete c[coord];
      return c;
    });
  }, []);

  const handleSave = () => {
    const edited = currentExcelBase64 !== excelBase64 ? currentExcelBase64 : undefined;
    onSave(Object.values(mappings), customLogo ?? undefined, edited);
  };

  const mappingCount = Object.keys(mappings).length;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-[4px]">
      <div className="flex max-h-[95vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
        <ExcelMapperHeader onClose={onClose} />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[270px] min-w-[270px] flex-col border-r border-slate-100 bg-neutral-50">
            <LogoUploader
              customLogo={customLogo}
              onUpload={handleLogoUpload}
              onRemove={() => setCustomLogo(null)}
            />
            <PlaceholdersList
              placeholders={availablePlaceholders}
              selected={selectedPlaceholder}
              mappings={mappings}
              onSelect={setSelectedPlaceholder}
            />
            <PlaceholderInstruction selected={selectedPlaceholder} />
          </div>

          <div className="flex-1 overflow-auto bg-slate-50 px-4 py-3.5">
            {loading && (
              <div className="flex h-[200px] items-center justify-center gap-2 text-slate-500">
                <span className="text-xl">⏳</span> Convirtiendo Excel con LibreOffice…
              </div>
            )}
            {error && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-600">
                ❌ {error}
              </div>
            )}
            {!loading && !error && previewHtml && (
              <>
                <div className="mb-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-dashed border-blue-500" />
                    Celda mapeable (hover)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-100" />
                    Ya mapeada
                  </span>
                </div>
                <ExcelHtmlTable
                  html={previewHtml}
                  css={previewCss}
                  mappings={mappings}
                  selectedPlaceholder={selectedPlaceholder}
                  customLogo={customLogo}
                  onCellClick={handleCellClick}
                  onRemoveMapping={removeMapping}
                  onCellEdit={handleCellEdit}
                />
                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <span>💡</span>
                  <span>
                    <strong>Click</strong> con un placeholder seleccionado para
                    mapearlo. <strong>Doble-click</strong> en cualquier celda sin
                    mapear para editar su texto (el Excel queda guardado con la
                    edición al guardar el mapeo).
                    {editing && <span className="ml-2 text-amber-700">· Guardando edición…</span>}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <ExcelMapperFooter
          mappingCount={mappingCount}
          hasCustomLogo={!!customLogo}
          onCancel={onClose}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
