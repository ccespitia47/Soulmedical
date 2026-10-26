import { useEffect, useMemo, useState } from 'react';
import { useFormRecords } from '../../hooks/useFormRecords';
import { requestBulkPdfApi, deleteSubmissionApi, type RecordRowDto } from '../../services/api';
import SubmissionsListView from './SubmissionsListView';
import ConfirmModal from '../common/ConfirmModal';
import DeleteRecordModal from './DeleteRecordModal';
import Icon from '../common/Icon';

type Props = {
  formId: string;
  formName: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export default function RecordsTable({ formId, formName }: Props) {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  // Dos states para la búsqueda: `q` refleja lo que el usuario ve mientras
  // escribe (no salta ni se resetea entre teclas), `debouncedQ` es lo que
  // se envía al backend después de 300ms de quietud. Sin debounce cada tecla
  // disparaba un fetch y la tabla parpadeaba porque el spinner reemplazaba
  // toda la vista (ver useFormRecords: `isInitialLoading` vs `loading`).
  const [q, setQ] = useState<string>('');
  const [debouncedQ, setDebouncedQ] = useState<string>('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const filters = useMemo(
    () => ({ from, to, q: debouncedQ }),
    [from, to, debouncedQ],
  );
  const {
    data,
    total,
    loading,
    isInitialLoading,
    error,
    page,
    setPage,
    pageCount,
    refresh,
  } = useFormRecords(formId, filters);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<RecordRowDto | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const handleDeleteConfirmed = async (reason: string): Promise<string | null> => {
    if (!rowToDelete) return 'Sin registro seleccionado';
    const res = await deleteSubmissionApi(rowToDelete.id, reason);
    if (res.error) return res.error;
    setRowToDelete(null);
    setDeleteFeedback({ kind: 'ok', msg: `Registro eliminado (${rowToDelete.id.slice(0, 8)}…). Queda registrado en el reporte de acciones.` });
    await refresh();
    return null;
  };

  const handleBulk = () => setBulkConfirmOpen(true);

  const handleBulkConfirmed = async () => {
    setBulkConfirmOpen(false);
    setBulkBusy(true);
    setBulkFeedback(null);
    // Endpoint responde 202 Accepted: la generación corre en background y el
    // usuario recibe el link por correo. Aquí solo confirmamos que arrancó.
    // Uso debouncedQ (no q) porque es el que refleja el filtro APLICADO en
    // la tabla — el usuario espera que el bulk envíe exactamente los N que ve.
    const res = await requestBulkPdfApi(formId, { from, to, q: debouncedQ });
    setBulkBusy(false);
    if (res.error || !res.data) {
      setBulkFeedback({ kind: 'err', msg: res.error ?? 'No se pudo iniciar la descarga masiva.' });
      return;
    }
    setBulkFeedback({
      kind: 'ok',
      msg:
        res.data.message ??
        'Estamos generando y enviándote los PDFs por correo. Esto puede tomar unos minutos.',
    });
  };

  return (
    <div className="animate-fade-up">
      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 rounded-[20px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)] backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Icon name="calendar" size={12} className="text-[#00c2a8]" /> Desde
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[12.5px] text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Icon name="calendar" size={12} className="text-[#00c2a8]" /> Hasta
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[12.5px] text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </div>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <Icon name="search" size={12} className="text-[#00c2a8]" /> Buscar
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={15} />
            </span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por texto o ID exacto…"
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white py-2 pl-9 pr-3 text-[12.5px] text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleBulk}
          disabled={bulkBusy || total === 0}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
        >
          <Icon name="package" size={15} />
          {bulkBusy ? 'Enviando…' : `Enviar todos (${total})`}
        </button>
      </div>

      {/* Estados
          - initial load (nunca hubo data): spinner grande centrado
          - error: banner rojo
          - refetch en curso (ya había data): la tabla NO se reemplaza; se
            muestra con un pequeño indicador arriba para evitar layout shift
            (era el bug de "página rara al escribir"). */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-slate-200/80 bg-white px-6 py-14 text-[13px] text-slate-400">
          <Icon name="refresh" size={16} className="animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-red-200 bg-red-50 px-6 py-10 text-center text-[13px] font-medium text-red-600">
          <Icon name="alert" size={16} className="flex-shrink-0" /> {error}
        </div>
      ) : (
        <div className="relative">
          {loading && (
            <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
              <Icon name="refresh" size={12} className="animate-spin" />
              Actualizando…
            </div>
          )}
          <div className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <SubmissionsListView
              data={data}
              total={total}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              formName={formName}
              onDeleteRequest={(row) => {
                setDeleteFeedback(null);
                setRowToDelete(row);
              }}
            />
          </div>
        </div>
      )}

      {bulkFeedback && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${bulkFeedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <Icon name={bulkFeedback.kind === 'ok' ? 'checkCircle' : 'alert'} size={15} className="flex-shrink-0" />
          <span>{bulkFeedback.msg}</span>
        </div>
      )}

      {deleteFeedback && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${deleteFeedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <Icon name={deleteFeedback.kind === 'ok' ? 'checkCircle' : 'alert'} size={15} className="flex-shrink-0" />
          <span>{deleteFeedback.msg}</span>
        </div>
      )}

      {rowToDelete && (
        <DeleteRecordModal
          recordId={rowToDelete.id}
          recordLabel={`${rowToDelete.userName} · ${new Date(rowToDelete.submittedAt).toLocaleString()}`}
          onCancel={() => setRowToDelete(null)}
          onConfirm={handleDeleteConfirmed}
        />
      )}

      {bulkConfirmOpen && (
        <ConfirmModal
          title="Enviar todos los PDFs por correo"
          message={`Se enviará un correo a tu buzón con un enlace único de descarga (válido 2 minutos) que contiene <strong>${total}</strong> PDF(s) del formulario <strong>${formName}</strong>. Al abrirlo se pedirá tu código 2FA y el ZIP quedará cifrado con tu número de documento.`}
          confirmLabel="Enviar por correo"
          confirmColor="#00c2a8"
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={handleBulkConfirmed}
        />
      )}
    </div>
  );
}
