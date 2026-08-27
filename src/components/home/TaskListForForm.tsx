import { useEffect, useRef, useState } from 'react';
import {
  getFormTasksApi,
  getTaskDetailApi,
  type TaskSummaryDto,
  type TaskDetailDto,
} from '../../services/api';
import TaskInfoPanel from '../reports/TaskInfoPanel';
import Icon from '../common/Icon';

type Props = {
  formId: string;
  formName: string;
};

const LIMIT = 20;

function statusBadge(status: string): { label: string; className: string } {
  if (status === 'in_progress') {
    return { label: 'Activa', className: 'bg-emerald-100 text-emerald-900' };
  }
  if (status === 'completed') {
    return { label: 'Completada', className: 'bg-cyan-100 text-cyan-900' };
  }
  if (status === 'cancelled') {
    return { label: 'Nula', className: 'bg-slate-200 text-slate-600 line-through' };
  }
  return { label: status, className: 'bg-slate-100 text-slate-700' };
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

export default function TaskListForForm({ formId, formName }: Props) {
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Contador de requests de detalle: clicks rápidos entre tareas pueden hacer
  // que una respuesta vieja llegue después de una más nueva y la sobrescriba.
  const detailRequestId = useRef(0);

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  // Reset de página/acordeón al cambiar de formulario (nueva card expandida).
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
    setDetail(null);
    setDetailError(null);
  }, [formId]);

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getFormTasksApi(formId, { page, limit: LIMIT });
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? 'No se pudieron cargar las tareas');
        return;
      }
      setTasks(res.data.data);
      setTotal(res.data.total);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [formId, page]);

  const refetchList = async () => {
    const res = await getFormTasksApi(formId, { page, limit: LIMIT });
    if (res.data) {
      setTasks(res.data.data);
      setTotal(res.data.total);
    }
  };

  const loadDetail = async (taskId: string) => {
    setDetail(null);
    setDetailError(null);
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

  const handleExpand = (taskId: string) => {
    if (expandedId === taskId) {
      setExpandedId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setExpandedId(taskId);
    void loadDetail(taskId);
  };

  const handleRefetchDetail = () => {
    if (expandedId) void loadDetail(expandedId);
  };

  const handleDeleted = () => {
    setExpandedId(null);
    setDetail(null);
    void refetchList();
  };

  return (
    <div className="animate-fade-up mt-1.5 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-[13px] text-slate-400">
          <Icon name="refresh" size={16} className="animate-spin" /> Cargando tareas…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-[13px] font-medium text-red-600">
          <Icon name="alert" size={16} className="flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && total === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center text-[13px] text-gray-400">
          Sin tareas creadas para este formulario.
        </div>
      )}

      {!loading && !error && total > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => {
              const isExpanded = expandedId === t.id;
              const badge = statusBadge(t.status);
              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_20px_-14px_rgba(15,40,80,0.25)]"
                >
                  {/* Fila resumen — clickeable */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleExpand(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleExpand(t.id);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/70"
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
                        <span className="truncate text-[13.5px] font-bold text-slate-900">
                          {t.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
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
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                      {detailLoading && (
                        <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-400">
                          <Icon name="refresh" size={16} className="animate-spin" /> Cargando
                          detalle…
                        </div>
                      )}

                      {!detailLoading && detailError && (
                        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-600">
                          <Icon name="alert" size={15} className="flex-shrink-0" /> {detailError}
                        </div>
                      )}

                      {!detailLoading && !detailError && detail && (
                        <TaskInfoPanel
                          key={detail.id}
                          detail={detail}
                          formName={formName}
                          onRefetch={handleRefetchDetail}
                          onDelete={handleDeleted}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="chevronRight" size={14} className="rotate-180" />
              </button>
              <span className="text-[12px] font-semibold text-slate-500">
                Página {page} de {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                aria-label="Página siguiente"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="chevronRight" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
