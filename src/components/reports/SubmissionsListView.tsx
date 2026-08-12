import { useMemo, useState } from 'react';
import type { RecordRowDto } from '../../services/api';
import { usePdfPreview } from '../../hooks/usePdfPreview';
import PdfPreviewModal from './PdfPreviewModal';
import Icon from '../common/Icon';

type Props = {
  data: RecordRowDto[];
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  formName?: string;
};

export default function SubmissionsListView({
  data,
  total,
  page,
  pageCount,
  onPageChange,
  emptyMessage = 'No hay registros en el rango seleccionado.',
  formName = 'Formulario',
}: Props) {
  const preview = usePdfPreview();
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = data.find((r) => r.id === openId) ?? null;

  const summaryCols = useMemo(() => {
    const cols = new Set<string>();
    for (const row of data) {
      for (const k of Object.keys(row.summary)) cols.add(k);
    }
    return Array.from(cols).slice(0, 4);
  }, [data]);

  const handleRowClick = (id: string, hasPdf: boolean) => {
    if (!hasPdf) return;
    setOpenId(id);
    preview.open(id);
  };

  const handleDownload = () => {
    if (!preview.blob) return;
    const a = document.createElement('a');
    a.href = preview.blobUrl!;
    a.download = preview.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      {data.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Icon name="inbox" size={26} />
          </div>
          <p className="text-[15px] font-bold text-slate-700">Sin registros</p>
          <p className="mt-1 text-[13px] text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="space-y-3 sm:hidden">
            {data.map((row) => (
              <div
                key={row.id}
                onClick={() => handleRowClick(row.id, row.hasPdf)}
                className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_20px_-14px_rgba(15,40,80,0.3)] ${row.hasPdf ? 'cursor-pointer' : ''}`}
                style={{ opacity: row.hasPdf ? 1 : 0.7 }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-slate-900">
                      {row.userName}
                    </div>
                    <div className="text-[11px] text-gray-400 tabular-nums">
                      {new Date(row.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  {row.hasPdf ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(row.id, true);
                      }}
                      className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0891b2] transition hover:bg-[#00c2a8]/10"
                    >
                      <Icon name="eye" size={13} /> Ver PDF
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-[11px] text-slate-400">Sin PDF</span>
                  )}
                </div>
                {summaryCols.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5">
                    {summaryCols.map((c) => (
                      <div key={c} className="min-w-0">
                        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {c}
                        </div>
                        <div className="truncate text-[12px] text-slate-700">
                          {row.summary[c] ?? '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Usuario</th>
                    {summaryCols.map((c) => (
                      <th key={c} className="px-4 py-3">{c}</th>
                    ))}
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const disabled = !row.hasPdf;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row.id, row.hasPdf)}
                        className={`border-b border-slate-100 transition-colors last:border-b-0 ${disabled ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50/70'}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-500">
                          {new Date(row.submittedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{row.userName}</td>
                        {summaryCols.map((c) => (
                          <td key={c} className="px-4 py-3 text-gray-600">
                            {row.summary[c] ?? ''}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          {row.hasPdf ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(row.id, true);
                              }}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0891b2] transition hover:bg-[#00c2a8]/10"
                            >
                              <Icon name="eye" size={13} /> Ver PDF
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">No disponible</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          <div className="mt-3 flex items-center justify-between text-[12px] text-slate-600">
            <span>
              Mostrando <span className="font-semibold text-slate-800">{data.length}</span> de{' '}
              <span className="font-semibold text-slate-800">{total}</span> registros
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200"
              >
                <Icon name="chevronRight" size={15} className="rotate-180" />
              </button>
              <span className="tabular-nums text-[12px] text-slate-500">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                disabled={page >= pageCount}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200"
              >
                <Icon name="chevronRight" size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      <PdfPreviewModal
        open={openId !== null}
        loading={preview.loading}
        error={preview.error}
        blobUrl={preview.blobUrl}
        filename={preview.filename}
        formName={formName}
        headerInfo={
          openRow
            ? `${openRow.userName} · ${new Date(openRow.submittedAt).toLocaleString()}`
            : undefined
        }
        onClose={() => {
          setOpenId(null);
          preview.close();
        }}
        onDownload={handleDownload}
      />
    </>
  );
}
