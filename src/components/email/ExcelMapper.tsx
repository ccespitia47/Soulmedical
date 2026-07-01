import { useState, useEffect } from "react";
import type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";
import {
  parseExcel,
  extractImages,
  type CellData,
  type EmbeddedImage,
} from "../../utils/excelParser";
import ExcelMapperHeader from "./excelMapper/ExcelMapperHeader";
import LogoUploader from "./excelMapper/LogoUploader";
import PlaceholdersList, {
  PlaceholderInstruction,
  type PlaceholderItem,
} from "./excelMapper/PlaceholdersList";
import ExcelTable from "./excelMapper/ExcelTable";
import ExcelMapperFooter from "./excelMapper/ExcelMapperFooter";

export type { ExcelFieldMapping as ExcelMapping } from "../../types/email-template.types";

type ExcelMapperProps = {
  excelBase64: string;
  existingMappings: ExcelMapping[];
  availablePlaceholders: PlaceholderItem[];
  onSave: (mappings: ExcelMapping[], logoBase64?: string) => void;
  onClose: () => void;
};

export default function ExcelMapper({
  excelBase64,
  existingMappings,
  availablePlaceholders,
  onSave,
  onClose,
}: ExcelMapperProps) {
  const [rows, setRows] = useState<CellData[][]>([]);
  const [mappings, setMappings] = useState<Record<string, ExcelMapping>>({});
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderItem | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [embeddedImages, setEmbeddedImages] = useState<EmbeddedImage[]>([]);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setRows(parseExcel(excelBase64));
        const map: Record<string, ExcelMapping> = {};
        for (const m of existingMappings) map[m.coord] = m;
        setMappings(map);
        setEmbeddedImages(await extractImages(excelBase64));
      } catch (e) {
        setError("No se pudo leer el archivo Excel.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [excelBase64, existingMappings]);

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCustomLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCellClick = (cell: CellData) => {
    if (!cell.isMappable || !selectedPlaceholder) return;
    setMappings((prev) => ({
      ...prev,
      [cell.coord]: {
        coord: cell.coord,
        placeholder: selectedPlaceholder.placeholder,
        description: selectedPlaceholder.description,
      },
    }));
    const idx = availablePlaceholders.indexOf(selectedPlaceholder);
    if (idx < availablePlaceholders.length - 1)
      setSelectedPlaceholder(availablePlaceholders[idx + 1]);
  };

  const removeMapping = (coord: string) => {
    setMappings((prev) => {
      const c = { ...prev };
      delete c[coord];
      return c;
    });
  };

  const handleSave = () => {
    onSave(Object.values(mappings), customLogo ?? undefined);
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
                <span className="text-xl">⏳</span> Cargando Excel...
              </div>
            )}
            {error && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-600">
                ❌ {error}
              </div>
            )}
            {!loading && !error && rows.length > 0 && (
              <ExcelTable
                rows={rows}
                mappings={mappings}
                selectedPlaceholder={selectedPlaceholder}
                hoveredCell={hoveredCell}
                customLogo={customLogo}
                embeddedImages={embeddedImages}
                onHover={setHoveredCell}
                onCellClick={handleCellClick}
                onRemoveMapping={removeMapping}
              />
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
