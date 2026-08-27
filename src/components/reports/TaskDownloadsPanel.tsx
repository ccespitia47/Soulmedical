import { useEffect, useMemo, useState } from 'react';
import {
  getFormTasksApi,
  getTaskDetailApi,
  requestTaskReportByEmailApi,
  requestTaskBulkPdfApi,
  type TaskSummaryDto,
  type TaskDetailDto,
} from '../../services/api';
import type { WidgetInstance } from '../../types/widget.types';
import ExcelFieldSelector from './ExcelFieldSelector';
import Icon from '../common/Icon';
import SelectMenu, { type SelectOption } from '../common/SelectMenu';

type Props = {
  formId: string;
  formName: string;
  widgets: WidgetInstance[];
};

type Feedback = { kind: 'ok' | 'err'; msg: string } | null;

/**
 * Pestaña "Descargas por tarea": elegir una tarea puntual del formulario y
 * descargar (por correo) su Excel con selección de campos, o todos sus PDFs.
 * A diferencia de la pestaña "Tareas" (legacy), este panel no depende de
 * `submissions.length` para habilitar los botones: los registros históricos
 * se preservan aunque la tarea haya sido eliminada, así que la descarga debe
 * seguir funcionando.
 */
export default function TaskDownloadsPanel({ formId, formName, widgets }: Props) {
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [detail, setDetail] = useState<TaskDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());

  const [excelBusy, setExcelBusy] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<Feedback>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<Feedback>(null);

  // Cargar el listado de tareas del formulario para el dropdown. Se asume
  // <100 tareas por formulario (fuera de ese rango habría que paginar).
  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    setTasksLoading(true);
    setTasksError(null);
    setSelectedTaskId('');
    setDetail(null);
    getFormTasksApi(formId, { page: 1, limit: 100 }).then((res) => {
      if (cancelled) return;
      setTasksLoading(false);
      if (res.error || !res.data) {
        setTasksError(res.error ?? 'No se pudieron cargar las tareas');
        return;
      }
      setTasks(res.data.data);
    });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  // Cargar el detalle (submissions, recipients) al elegir una tarea.
  useEffect(() => {
    if (!selectedTaskId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setExcelFeedback(null);
    setBulkFeedback(null);
    getTaskDetailApi(selectedTaskId).then((res) => {
      if (cancelled) return;
      setDetailLoading(false);
      if (res.error || !res.data) {
        setDetailError(res.error ?? 'No se pudo cargar el detalle de la tarea');
        return;
      }
      setDetail(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  // Los widgets vienen del formulario (prop), no de la tarea: preseleccionar
  // todos los campos con label cada vez que se elige una tarea distinta.
  const allFieldIds = useMemo(
    () => widgets.filter((w) => !!w.label?.trim()).map((w) => w.id),
    [widgets],
  );
  useEffect(() => {
    setSelectedFieldIds(new Set(allFieldIds));
  }, [allFieldIds, selectedTaskId]);

  const taskOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: '— Seleccionar tarea —' },
      ...tasks.map((t) => ({ value: t.id, label: t.title })),
    ],
    [tasks],
  );

  const handleExcel = async () => {
    if (!selectedTaskId) return;
    setExcelBusy(true);
    setExcelFeedback(null);
    const res = await requestTaskReportByEmailApi(
      formId,
      selectedTaskId,
      Array.from(selectedFieldIds),
    );
    setExcelBusy(false);
    if (res.error || !res.data) {
      setExcelFeedback({ kind: 'err', msg: res.error ?? 'No se pudo generar el reporte.' });
      return;
    }
    setExcelFeedback({ kind: 'ok', msg: res.data.message });
  };

  const handleBulkPdf = async () => {
    if (!selectedTaskId) return;
    setBulkBusy(true);
    setBulkFeedback(null);
    const res = await requestTaskBulkPdfApi(selectedTaskId);
    setBulkBusy(false);
    if (res.error) {
      setBulkFeedback({ kind: 'err', msg: res.error });
      return;
    }
    setBulkFeedback({ kind: 'ok', msg: res.data?.message ?? 'Los PDFs van en camino a tu correo.' });
  };

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      {/* Selector de tarea */}
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)]">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <Icon name="inbox" size={12} className="text-[#00c2a8]" /> Tarea de {formName}
        </label>

        {tasksLoading && (
          <div className="flex items-center gap-2 py-2 text-[13px] text-slate-400">
            <Icon name="refresh" size={15} className="animate-spin" /> Cargando tareas…
          </div>
        )}

        {!tasksLoading && tasksError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-600">
            <Icon name="alert" size={15} className="flex-shrink-0" /> {tasksError}
          </div>
        )}

        {!tasksLoading && !tasksError && tasks.length === 0 && (
          <p className="m-0 text-[13px] text-gray-400">
            Este formulario no tiene tareas creadas aún.
          </p>
        )}

        {!tasksLoading && !tasksError && tasks.length > 0 && (
          <SelectMenu
            value={selectedTaskId}
            onChange={setSelectedTaskId}
            options={taskOptions}
            leftIcon="inbox"
          />
        )}
      </div>

      {detailLoading && (
        <div className="flex items-center justify-center gap-2 rounded-[20px] border border-slate-200/80 bg-white px-6 py-10 text-[13px] text-slate-400">
          <Icon name="refresh" size={16} className="animate-spin" /> Cargando detalle de la tarea…
        </div>
      )}

      {!detailLoading && detailError && (
        <div className="flex items-center gap-2 rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-[12.5px] font-medium text-red-600">
          <Icon name="alert" size={15} className="flex-shrink-0" /> {detailError}
        </div>
      )}

      {!detailLoading && !detailError && detail && (
        <div className="animate-fade-up rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)]">
          {/* Aviso de envío */}
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3.5 py-3 text-[12.5px] text-slate-700">
            <Icon name="mail" size={16} className="mt-px flex-shrink-0 text-[#0891b2]" />
            <span>
              Te enviaremos por correo el archivo de{' '}
              <strong className="text-slate-800">{detail.title}</strong>. El enlace de descarga
              dura 2 min y requiere 2FA.
            </span>
          </div>

          {detail.submissions.length === 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800">
              <Icon name="alert" size={16} className="mt-px flex-shrink-0" />
              <span>Sin registros aún — el Excel estará vacío.</span>
            </div>
          )}

          <ExcelFieldSelector
            widgets={widgets}
            selectedFieldIds={selectedFieldIds}
            onChange={setSelectedFieldIds}
          />

          {(excelFeedback || bulkFeedback) && (
            <div className="mt-4 flex flex-col gap-2">
              {[excelFeedback, bulkFeedback].filter(Boolean).map((fb, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
                    fb!.kind === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  <Icon
                    name={fb!.kind === 'ok' ? 'checkCircle' : 'alert'}
                    size={15}
                    className="flex-shrink-0"
                  />
                  <span>{fb!.msg}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleBulkPdf}
              disabled={bulkBusy || !selectedTaskId}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-4 py-2.5 text-[12.5px] font-bold text-[#0891b2] transition hover:bg-[#00c2a8]/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                name={bulkBusy ? 'refresh' : 'download'}
                size={14}
                className={bulkBusy ? 'animate-spin' : ''}
              />
              {bulkBusy ? 'Enviando…' : 'Descargar todos los PDF'}
            </button>
            <button
              type="button"
              onClick={handleExcel}
              disabled={excelBusy || !selectedTaskId}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              <Icon name="send" size={15} />
              {excelBusy ? 'Enviando…' : 'Solicitar reporte'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
