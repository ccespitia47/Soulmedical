import { useMemo, useState } from 'react';
import { useFormRecords } from '../../hooks/useFormRecords';
import { requestBulkPdfApi } from '../../services/api';
import SubmissionsListView from './SubmissionsListView';
import ConfirmModal from '../common/ConfirmModal';
import Icon from '../common/Icon';

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

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleBulk = () => setBulkConfirmOpen(true);

  const handleBulkConfirmed = async () => {
    setBulkConfirmOpen(false);
    setBulkBusy(true);
    setBulkFeedback(null);
    // Endpoint responde 202 Accepted: la generación corre en background y el
    // usuario recibe el link por correo. Aquí solo confirmamos que arrancó.
    const res = await requestBulkPdfApi(formId, { from, to, q });
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
              placeholder="Buscar por texto…"
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

      {/* Estados */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-slate-200/80 bg-white px-6 py-14 text-[13px] text-slate-400">
          <Icon name="refresh" size={16} className="animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-red-200 bg-red-50 px-6 py-10 text-center text-[13px] font-medium text-red-600">
          <Icon name="alert" size={16} className="flex-shrink-0" /> {error}
        </div>
      ) : (
        <SubmissionsListView
          data={data}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          formName={formName}
        />
      )}

      {bulkFeedback && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${bulkFeedback.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <Icon name={bulkFeedback.kind === 'ok' ? 'checkCircle' : 'alert'} size={15} className="flex-shrink-0" />
          <span>{bulkFeedback.msg}</span>
        </div>
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
