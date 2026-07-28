import { useMemo, useState } from 'react';
import { useFormRecords } from '../../hooks/useFormRecords';
import { usePdfPreview } from '../../hooks/usePdfPreview';
import { requestBulkPdfApi } from '../../services/api';
import PdfPreviewModal from './PdfPreviewModal';

type Props = {
  formId: string;
  formName: string;
};

export default function RecordsTable({ formId, formName }: Props) {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const filters = useMemo(() => ({ from, to, q }), [from, to, q]);
  const { data, total, loading, error, page, setPage, pageCount } = useFormRecords(
    formId,
    filters,
  );
  const preview = usePdfPreview();

  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = data.find((r) => r.id === openId) ?? null;

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

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

  const handleBulk = async () => {
    if (!confirm(`Se enviará un correo con el link de descarga de todos los PDFs de "${formName}". ¿Continuar?`)) return;
    setBulkBusy(true);
    setBulkFeedback(null);
    const res = await requestBulkPdfApi(formId, { from, to, q });
    setBulkBusy(false);
    if (res.error || !res.data) {
      setBulkFeedback({ kind: 'err', msg: res.error ?? 'No se pudo iniciar la descarga masiva.' });
      return;
    }
    if (!res.data.ok) {
      setBulkFeedback({ kind: 'err', msg: res.data.message });
      return;
    }
    setBulkFeedback({ kind: 'ok', msg: res.data.message });
  };

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <span className="text-[11px] font-semibold text-slate-600">Desde</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-[12px]"
        />
        <span className="text-[11px] font-semibold text-slate-600">Hasta</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-[12px]"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Buscar por texto"
          className="ml-2 flex-1 rounded border border-slate-300 px-2.5 py-1 text-[12px]"
        />
        <button
          type="button"
          onClick={handleBulk}
          disabled={bulkBusy || total === 0}
          className="ml-auto cursor-pointer rounded-md border-none bg-[#00c2a8] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {bulkBusy ? 'Enviando…' : `📦 Enviar todos por correo (${total})`}
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Fecha
              </th>
              <th className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Usuario
              </th>
              {summaryCols.map((c) => (
                <th
                  key={c}
                  className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500"
                >
                  {c}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={summaryCols.length + 3} className="px-3 py-8 text-center text-slate-400">
                  Sin registros en el rango seleccionado.
                </td>
              </tr>
            )}
            {!loading && !error &&
              data.map((row) => {
                const disabled = !row.hasPdf;
                return (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row.id, row.hasPdf)}
                    className={`border-b border-slate-100 ${disabled ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      {new Date(row.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">{row.userName}</td>
                    {summaryCols.map((c) => (
                      <td key={c} className="px-3 py-2.5">
                        {row.summary[c] ?? ''}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      {row.hasPdf ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row.id, true);
                          }}
                          className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          👁 Ver PDF
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
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
          <span>
            Mostrando {data.length} de {total} registros
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 py-0.5">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
              className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {bulkFeedback && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${bulkFeedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {bulkFeedback.kind === 'ok' ? '✓ ' : '⚠️ '}{bulkFeedback.msg}
        </div>
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
    </div>
  );
}
