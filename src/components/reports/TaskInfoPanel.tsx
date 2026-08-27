import { useState } from 'react';
import {
  cancelTaskApi,
  resendTaskStepApi,
  toggleTaskShareLinkApi,
  type TaskDetailDto,
  type TaskRecipientDto,
} from '../../services/api';
import SubmissionsListView from './SubmissionsListView';
import Icon from '../common/Icon';
import ConfirmModal from '../common/ConfirmModal';

type Props = {
  detail: TaskDetailDto;
  formName: string;
  /** Llamado tras acciones que cambian el detail (resend, toggle enlace, toggle oneShot). */
  onRefetch: () => void;
  /** Llamado cuando el user confirma delete (parent maneja el refetch de la lista). */
  onDelete: () => void;
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TaskInfoPanel({ detail, formName, onRefetch, onDelete }: Props) {
  const [linkBusy, setLinkBusy] = useState(false);
  const [confirmDisableLink, setConfirmDisableLink] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [resendBusy, setResendBusy] = useState<number | null>(null);
  const [resendFeedback, setResendFeedback] = useState<Feedback>(null);
  const [shareCheckboxKey, setShareCheckboxKey] = useState(0);
  const [oneShotBusy, setOneShotBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCopyLink = async () => {
    if (!detail.shareLinkUrl) return;
    await navigator.clipboard.writeText(detail.shareLinkUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const doToggleShareLink = async (nextEnabled: boolean) => {
    setLinkBusy(true);
    const res = await toggleTaskShareLinkApi(detail.id, nextEnabled);
    setLinkBusy(false);
    if (res.error || !res.data) {
      setShareCheckboxKey((k) => k + 1);
      setActionError(res.error ?? 'No se pudo actualizar el enlace');
      return;
    }
    onRefetch();
  };

  const handleToggleShareLink = async (nextEnabled: boolean) => {
    if (!nextEnabled && detail.shareLinkUrl) {
      // En vez del confirm nativo del navegador, mostramos un modal. Revertimos
      // el checkbox (remount) hasta que el usuario confirme en el modal.
      setShareCheckboxKey((k) => k + 1);
      setConfirmDisableLink(true);
      return;
    }
    await doToggleShareLink(nextEnabled);
  };

  const handleToggleOneShot = async (nextValue: boolean) => {
    setOneShotBusy(true);
    const res = await toggleTaskShareLinkApi(detail.id, true, nextValue);
    setOneShotBusy(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    onRefetch();
  };

  const handleResend = async (recipient: TaskRecipientDto) => {
    setResendBusy(recipient.stepIndex);
    setResendFeedback(null);
    const res = await resendTaskStepApi(detail.id, recipient.stepIndex);
    setResendBusy(null);
    if (res.error) {
      setResendFeedback({ kind: 'err', msg: res.error });
      return;
    }
    setResendFeedback({ kind: 'ok', msg: `Correo reenviado a ${recipient.email}` });
    // Refetch para actualizar lastResendAt/canResend del paso.
    onRefetch();
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await cancelTaskApi(detail.id);
    setDeleteBusy(false);
    setConfirmDeleteOpen(false);
    if (res.error) {
      // NO usar un estado que gate el render del panel entero: un fallo
      // (network blip, race) no debe ocultar el detalle ya cargado.
      setDeleteError(res.error);
      return;
    }
    onDelete();
  };

  return (
    <div className="flex flex-col gap-4">
      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-600">
          <Icon name="alert" size={15} className="flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatChip icon="users" value={detail.recipients.length} label="Destinatarios" color="#334155" />
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
        <StatChip icon="link" value={detail.externalCount} label="Externos" color="#0891b2" />
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

        {detail.shareLinkUrl && (
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={detail.shareLinkOneShot}
              disabled={oneShotBusy}
              onChange={(e) => handleToggleOneShot(e.target.checked)}
            />
            Solo permitir un llenado por link
            {oneShotBusy && <Icon name="refresh" size={12} className="animate-spin text-slate-400" />}
          </label>
        )}

        {detail.shareLinkOneShot && !detail.shareLinkUrl && (
          <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
            Este enlace ya fue utilizado y no acepta nuevas respuestas. Toca &quot;Generar enlace
            compartible&quot; para crear uno nuevo.
          </div>
        )}
      </div>

      {/* Destinatarios */}
      <RecipientsTable recipients={detail.recipients} resendBusy={resendBusy} onResend={handleResend} />

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
              Esta tarea todavía no tiene registros completados aquí. Si es una tarea secuencial
              (varios pasos), los envíos se registran al finalizar el último paso.
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

      {/* Eliminar tarea */}
      {detail.status === 'in_progress' && (
        <div className="flex items-center justify-end border-t border-slate-200/80 pt-3.5">
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-red-200 bg-red-50 px-4 py-2.5 text-[12.5px] font-bold text-red-700 transition hover:bg-red-100"
          >
            <Icon name="trash" size={14} /> Eliminar tarea
          </button>
        </div>
      )}

      {deleteError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <span className="flex items-center gap-2">
            <Icon name="alert" size={14} /> {deleteError}
          </span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="cursor-pointer text-[16px] leading-none text-red-500 hover:text-red-700"
            aria-label="Cerrar mensaje de error"
          >
            ×
          </button>
        </div>
      )}

      {confirmDisableLink && (
        <ConfirmModal
          title="Inhabilitar enlace"
          message="El enlace actual dejará de funcionar y las personas ya no podrán diligenciar la tarea con él. ¿Deseas continuar?"
          confirmLabel="Inhabilitar enlace"
          confirmColor="#ef4444"
          onCancel={() => setConfirmDisableLink(false)}
          onConfirm={() => {
            setConfirmDisableLink(false);
            void doToggleShareLink(false);
          }}
        />
      )}

      {confirmDeleteOpen && (
        <ConfirmModal
          title="Eliminar tarea"
          message="¿Eliminar esta tarea? Los destinatarios que no la completaron ya no recibirán recordatorios y el enlace compartible dejará de funcionar. Esta acción no se puede deshacer."
          confirmLabel={deleteBusy ? 'Eliminando…' : 'Eliminar'}
          confirmColor="#ef4444"
          busy={deleteBusy}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
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
