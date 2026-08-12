import { useEffect, useRef, useState } from 'react';
import {
  getFormTasksApi,
  getTaskDetailApi,
  resendTaskStepApi,
  requestTaskBulkPdfApi,
  toggleTaskShareLinkApi,
  type TaskSummaryDto,
  type TaskDetailDto,
  type TaskRecipientDto,
} from '../../services/api';
import SubmissionsListView from './SubmissionsListView';
import Icon from '../common/Icon';

type Props = {
  formId: string;
  formName: string;
};

type Feedback = { kind: 'ok' | 'err'; msg: string } | null;

const RECIPIENT_STATUS_CFG: Record<
  TaskRecipientDto['status'],
  { bg: string; color: string; label: string; icon: string }
> = {
  completed: { bg: '#dcfce7', color: '#065f46', label: 'Completado', icon: 'checkCircle' },
  in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'En curso', icon: 'clock' },
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente', icon: 'clock' },
};

const TASK_STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

function formatTaskStatus(status: string): string {
  return TASK_STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TasksReportPanel({ formId, formName }: Props) {
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [linkBusy, setLinkBusy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [resendBusy, setResendBusy] = useState<number | null>(null);
  const [resendFeedback, setResendFeedback] = useState<Feedback>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<Feedback>(null);
  const [shareCheckboxKey, setShareCheckboxKey] = useState(0);

  // Contador de requests de detalle: clicks rápidos entre tarea A → B pueden
  // hacer que la respuesta de A llegue después de B y la sobrescriba. Cada
  // fetch se marca con un id; si al resolver ya no es el último emitido, se
  // descarta (mismo patrón para el refetch tras resend).
  const detailRequestId = useRef(0);

  // Carga el listado de tareas del formulario.
  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setExpandedId(null);
      setDetail(null);
      const res = await getFormTasksApi(formId);
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? 'No se pudieron cargar las tareas');
        return;
      }
      setTasks(res.data);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [formId]);

  const resetDetailUiState = () => {
    setLinkBusy(false);
    setCopyFeedback(false);
    setResendBusy(null);
    setResendFeedback(null);
    setBulkBusy(false);
    setBulkFeedback(null);
    setDetailError(null);
  };

  const handleExpand = async (taskId: string) => {
    if (expandedId === taskId) {
      setExpandedId(null);
      setDetail(null);
      resetDetailUiState();
      return;
    }
    setExpandedId(taskId);
    setDetail(null);
    resetDetailUiState();
    setDetailLoading(true);
    const myReqId = ++detailRequestId.current;
    const res = await getTaskDetailApi(taskId);
    if (myReqId !== detailRequestId.current) return; // respuesta obsoleta
    setDetailLoading(false);
    if (res.error || !res.data) {
      setDetailError(res.error ?? 'No se pudo cargar el detalle de la tarea');
      return;
    }
    setDetail(res.data);
  };

  const handleCopyLink = async () => {
    if (!detail?.shareLinkUrl) return;
    await navigator.clipboard.writeText(detail.shareLinkUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleToggleShareLink = async (nextEnabled: boolean) => {
    if (!detail) return;
    if (!nextEnabled && detail.shareLinkUrl) {
      if (!window.confirm('El enlace actual dejará de funcionar. ¿Continuar?')) {
        // El checkbox nativo ya cambió su estado DOM interno al clickear;
        // forzar remount para que vuelva a reflejar detail.shareLinkUrl.
        setShareCheckboxKey((k) => k + 1);
        return;
      }
    }
    setLinkBusy(true);
    const res = await toggleTaskShareLinkApi(detail.id, nextEnabled);
    setLinkBusy(false);
    if (res.error || !res.data) {
      setShareCheckboxKey((k) => k + 1);
      setDetailError(res.error ?? 'No se pudo actualizar el enlace');
      return;
    }
    if (res.data) {
      setDetail({ ...detail, shareLinkUrl: res.data.shareLinkUrl });
      setTasks((prev) =>
        prev.map((t) => (t.id === detail.id ? { ...t, hasShareLink: !!res.data!.shareLinkUrl } : t)),
      );
    }
  };

  const handleResend = async (recipient: TaskRecipientDto) => {
    if (!detail) return;
    setResendBusy(recipient.stepIndex);
    setResendFeedback(null);
    const res = await resendTaskStepApi(detail.id, recipient.stepIndex);
    setResendBusy(null);
    if (res.error) {
      setResendFeedback({ kind: 'err', msg: res.error });
      return;
    }
    setResendFeedback({ kind: 'ok', msg: `Correo reenviado a ${recipient.email}` });
    // Refetch de detail para actualizar lastResendAt/canResend del paso.
    const myReqId = ++detailRequestId.current;
    const fresh = await getTaskDetailApi(detail.id);
    if (myReqId !== detailRequestId.current) return; // respuesta obsoleta
    if (fresh.data) setDetail(fresh.data);
  };

  const handleBulkPdf = async () => {
    if (!detail) return;
    setBulkBusy(true);
    setBulkFeedback(null);
    const res = await requestTaskBulkPdfApi(detail.id);
    setBulkBusy(false);
    if (res.error) {
      setBulkFeedback({ kind: 'err', msg: res.error });
      return;
    }
    setBulkFeedback({ kind: 'ok', msg: res.data?.message ?? 'Los PDFs van en camino a tu correo.' });
  };

  return (
    <div className="animate-fade-up flex flex-col gap-3">
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-slate-200/80 bg-white px-6 py-14 text-[13px] text-slate-400">
          <Icon name="refresh" size={16} className="animate-spin" /> Cargando tareas…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-red-200 bg-red-50 px-6 py-10 text-center text-[13px] font-medium text-red-600">
          <Icon name="alert" size={16} className="flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Icon name="send" size={26} />
          </div>
          <p className="text-[15px] font-bold text-slate-700">Sin tareas</p>
          <p className="mt-1 text-[13px] text-gray-400">
            Aún no se han creado tareas para {formName}.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        tasks.map((t) => {
          const isExpanded = expandedId === t.id;
          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)]"
            >
              {/* Fila resumen — clickeable */}
              <button
                type="button"
                onClick={() => handleExpand(t.id)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/70"
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isExpanded
                      ? 'bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon name="send" size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13.5px] font-bold text-slate-900">{t.title}</span>
                    <span
                      className="rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: '#f1f5f9', color: '#475569' }}
                    >
                      {formatTaskStatus(t.status)}
                    </span>
                    {t.hasShareLink && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#00c2a8]/10 px-2 py-px text-[10px] font-bold text-[#0891b2]">
                        <Icon name="link" size={10} /> Enlace activo
                      </span>
                    )}
                  </div>
                  <p className="m-0 mt-0.5 truncate text-[11.5px] text-gray-400">
                    Creada por {t.createdByName} · {formatDateTime(t.createdAt)}
                  </p>
                </div>

                <div className="hidden flex-shrink-0 items-center gap-3 text-[11.5px] text-slate-500 sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="users" size={13} className="text-slate-400" /> {t.totalRecipients}
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Icon name="checkCircle" size={13} /> {t.completedCount}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Icon name="clock" size={13} /> {t.pendingCount}
                  </span>
                </div>

                <Icon
                  name="chevronRight"
                  size={16}
                  className={`flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                  {detailLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-400">
                      <Icon name="refresh" size={16} className="animate-spin" /> Cargando detalle…
                    </div>
                  )}

                  {!detailLoading && detailError && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-600">
                      <Icon name="alert" size={15} className="flex-shrink-0" /> {detailError}
                    </div>
                  )}

                  {!detailLoading && detail && (
                    <div className="flex flex-col gap-4">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <StatChip
                          icon="users"
                          value={detail.recipients.length}
                          label="Destinatarios"
                          color="#334155"
                        />
                        <StatChip
                          icon="checkCircle"
                          value={detail.recipients.filter((r) => r.status === 'completed').length}
                          label="Completados"
                          color="#059669"
                        />
                        <StatChip
                          icon="clock"
                          value={detail.recipients.filter((r) => r.status !== 'completed').length}
                          label="Pendientes"
                          color="#b45309"
                        />
                      </div>

                      {/* Enlace compartible */}
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <span
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[6px] transition-colors"
                            style={{
                              border: `2px solid ${detail.shareLinkUrl ? '#00c2a8' : '#cbd5e1'}`,
                              background: detail.shareLinkUrl ? '#00c2a8' : '#fff',
                            }}
                          >
                            {detail.shareLinkUrl && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12l5 5L20 7" />
                              </svg>
                            )}
                          </span>
                          <input
                            key={`share-cbx-${shareCheckboxKey}`}
                            type="checkbox"
                            checked={!!detail.shareLinkUrl}
                            disabled={linkBusy}
                            onChange={(e) => handleToggleShareLink(e.target.checked)}
                            className="sr-only"
                          />
                          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700">
                            <Icon name="link" size={14} className="text-[#00c2a8]" />
                            Generar enlace compartible
                          </span>
                          {linkBusy && <Icon name="refresh" size={13} className="animate-spin text-slate-400" />}
                        </label>

                        {detail.shareLinkUrl && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <input
                              readOnly
                              value={detail.shareLinkUrl}
                              onFocus={(e) => e.currentTarget.select()}
                              className="w-full min-w-0 flex-1 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] text-gray-700 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleCopyLink}
                              className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-3 py-2 text-[12px] font-semibold text-[#0891b2] transition hover:bg-[#00c2a8]/10"
                            >
                              <Icon name={copyFeedback ? 'checkCircle' : 'copy'} size={13} />
                              {copyFeedback ? 'Copiado ✓' : 'Copiar'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Destinatarios */}
                      <RecipientsTable
                        recipients={detail.recipients}
                        resendBusy={resendBusy}
                        onResend={handleResend}
                      />

                      {resendFeedback && (
                        <div
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
                            resendFeedback.kind === 'ok'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-red-200 bg-red-50 text-red-800'
                          }`}
                        >
                          <Icon
                            name={resendFeedback.kind === 'ok' ? 'checkCircle' : 'alert'}
                            size={15}
                            className="flex-shrink-0"
                          />
                          <span>{resendFeedback.msg}</span>
                        </div>
                      )}

                      {/* Registros completados */}
                      <div>
                        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">
                          Registros completados
                        </h4>

                        {detail.submissions.length === 0 && detail.recipients.length > 0 && (
                          <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3.5 py-2.5 text-[12px] text-slate-700">
                            <Icon name="alert" size={14} className="mt-px flex-shrink-0 text-[#0891b2]" />
                            <span>
                              Esta tarea todavía no tiene registros completados aquí. Si es una tarea
                              secuencial (varios pasos), los envíos se registran al finalizar el último
                              paso.
                            </span>
                          </div>
                        )}

                        <SubmissionsListView
                          data={detail.submissions}
                          total={detail.submissions.length}
                          page={1}
                          pageCount={1}
                          onPageChange={() => {}}
                          emptyMessage="Aún no hay registros completados para esta tarea."
                          formName={formName}
                        />
                      </div>

                      {/* Descarga masiva */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 pt-3.5">
                        <span className="text-[11.5px] text-gray-400">
                          Recibirás un correo con el enlace de descarga.
                        </span>
                        <button
                          type="button"
                          onClick={handleBulkPdf}
                          disabled={bulkBusy || detail.submissions.length === 0}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                        >
                          <Icon name="download" size={14} />
                          {bulkBusy ? 'Enviando…' : 'Descargar todos los PDF'}
                        </button>
                      </div>

                      {bulkFeedback && (
                        <div
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
                            bulkFeedback.kind === 'ok'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-red-200 bg-red-50 text-red-800'
                          }`}
                        >
                          <Icon
                            name={bulkFeedback.kind === 'ok' ? 'checkCircle' : 'alert'}
                            size={15}
                            className="flex-shrink-0"
                          />
                          <span>{bulkFeedback.msg}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function StatChip({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white py-2.5 text-center">
      <span className="flex items-center gap-1.5 text-[16px] font-extrabold" style={{ color }}>
        <Icon name={icon} size={14} />
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  );
}

function RecipientsTable({
  recipients,
  resendBusy,
  onResend,
}: {
  recipients: TaskRecipientDto[];
  resendBusy: number | null;
  onResend: (recipient: TaskRecipientDto) => void;
}) {
  if (recipients.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-[12.5px] text-gray-400">
        Esta tarea no tiene destinatarios registrados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-3.5 py-2.5">Destinatario</th>
              <th className="px-3.5 py-2.5">Estado</th>
              <th className="px-3.5 py-2.5">Completado</th>
              <th className="px-3.5 py-2.5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => {
              const cfg = RECIPIENT_STATUS_CFG[r.status];
              const busy = resendBusy === r.stepIndex;
              const disabledTitle = !r.canResend
                ? r.lastResendAt
                  ? `Ya se reenvió recientemente (${formatDateTime(r.lastResendAt)}). Espera unos minutos antes de reintentar.`
                  : 'No disponible en este momento.'
                : undefined;
              return (
                <tr key={r.stepIndex} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3.5 py-2.5">
                    <div className="font-semibold text-gray-900">{r.name || r.email}</div>
                    {r.name && <div className="text-[11px] text-gray-400">{r.email}</div>}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <Icon name={cfg.icon} size={11} /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-500 tabular-nums">
                    {r.submittedAt ? formatDateTime(r.submittedAt) : '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {r.status !== 'completed' && (
                      <button
                        type="button"
                        title={disabledTitle}
                        disabled={!r.canResend || busy}
                        onClick={() => onResend(r)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0891b2] transition hover:bg-[#00c2a8]/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <Icon name={busy ? 'refresh' : 'mail'} size={12} className={busy ? 'animate-spin' : ''} />
                        {busy ? 'Enviando…' : 'Reenviar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
