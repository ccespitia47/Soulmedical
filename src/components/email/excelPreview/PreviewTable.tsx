import { forwardRef } from "react";
import type { ExcelFieldMapping } from "../../../types/email-template.types";
import {
  PREVIEW_COL_LETTERS,
  PREVIEW_ROW_PX,
  type PreviewCellData,
} from "../../../utils/excelPreviewParser";

type PreviewTableProps = {
  rows: PreviewCellData[][];
  colWidths: Record<string, number>;
  rowHeights: Record<number, number>;
  mappings: ExcelFieldMapping[];
  customLogoBase64?: string;
  isReal: boolean;
  resolveValue: (coord: string, originalValue: string) => string;
};

const PreviewTable = forwardRef<HTMLDivElement, PreviewTableProps>(function PreviewTable(
  { rows, colWidths, rowHeights, mappings, customLogoBase64, isReal, resolveValue },
  ref
) {
  return (
    <div
      ref={ref}
      className="inline-block rounded bg-white p-3 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
    >
      <table
        className="border-collapse font-sans text-[10px]"
        style={{ tableLayout: "fixed", fontFamily: "Arial, sans-serif" }}
      >
        <colgroup>
          {PREVIEW_COL_LETTERS.map((col) => (
            <col key={col} style={{ width: colWidths[col] || 100 }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ height: rowHeights[row[0]?.row] || PREVIEW_ROW_PX }}>
              {row.map((cell) => {
                const displayValue = resolveValue(cell.coord, cell.value);
                const isMapped = mappings.some((m) => m.coord === cell.coord);
                const isLogoCell = customLogoBase64 && cell.coord === "A1";

                return (
                  <td
                    key={cell.coord}
                    colSpan={cell.colspan}
                    rowSpan={cell.rowspan}
                    className="border border-gray-400 bg-white px-1 py-0.5 align-middle text-black"
                    style={{
                      fontWeight: cell.style.bold ? 700 : 400,
                      fontSize: cell.style.fontSize,
                      textAlign: cell.style.align,
                      wordBreak: "break-word",
                      lineHeight: 1.3,
                      outline: isMapped ? "2px solid #00c2a8" : "none",
                      outlineOffset: "-2px",
                    }}
                  >
                    {isLogoCell ? (
                      <img
                        src={customLogoBase64}
                        alt="logo"
                        className="mx-auto block max-h-[50px] max-w-full object-contain"
                      />
                    ) : (
                      <span
                        style={{
                          color: isMapped && !isReal ? "#0369a1" : "#000000",
                          fontStyle: isMapped && !isReal ? "italic" : "normal",
                        }}
                      >
                        {displayValue}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default PreviewTable;
