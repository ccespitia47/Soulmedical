// Vista de registros unificada de Consientify (Task 6, Plan 3): tabla de
// `consent_records` con filtros por tipo/rango/búsqueda y acciones por fila
// (ver, descargar PDF, editar, anular). Reutiliza un único componente de
// tabla para los 6 tipos de `CONSENT_TYPES`.

import { useState, useEffect, useRef } from "react";
import { useConsentRecords } from "./useConsentRecords";
import { buildRecordPdfHtml, triggerPdfDownload } from "./consentRecordPdf";
import ConsentRecordViewModal from "./ConsentRecordViewModal";
import ConsentForm from "../ConsentForm";
import { CONSENT_TYPES, type ConsentTipo } from "../definitions";
import { anularConsentApi, type ConsentRecordDto } from "../../../services/api";
import { htmlToPdfBase64 } from "../../../utils/pdfExporter";
import Icon from "../../common/Icon";
import ConfirmModal from "../../common/ConfirmModal";

const ESTADO_BADGE: Record<string, string> = {
  firmado: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  borrador: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  anulado: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function tipoLabel(tipo: string): string {
  return CONSENT_TYPES.find((t) => t.tipo === tipo)?.label ?? tipo;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

type ConsentRecordsPageProps = {
  /** El marco mantiene esta vista montada aunque esté oculta; al volver a ser
   *  visible hay que recargar, o un consentimiento recién guardado no saldría. */
  activa?: boolean;
};

export default function ConsentRecordsPage({ activa = true }: ConsentRecordsPageProps) {
  const { rows, total, page, limit, filters, setFilters, setPage, refetch, loading } = useConsentRecords();

  // Recarga al pasar de oculta a visible. El hook ya pide al montar, pero con
  // el marco esta página se monta UNA vez y vive toda la sesión.
  const eraActiva = useRef(activa);
  useEffect(() => {
    if (activa && !eraActiva.current) refetch();
    eraActiva.current = activa;
  }, [activa, refetch]);

  // Borrador local del filtro: solo golpea la API al enviar (botón "Filtrar"),
  // no en cada tecla.
  const [tipoDraft, setTipoDraft] = useState(filters.tipo ?? "");
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");
  const [fromDraft, setFromDraft] = useState(filters.from ?? "");
  const [toDraft, setToDraft] = useState(filters.to ?? "");

  const [editing, setEditing] = useState<ConsentRecordDto | null>(null);
  const [viewing, setViewing] = useState<ConsentRecordDto | null>(null);
  const [anularTarget, setAnularTarget] = useState<ConsentRecordDto | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (editing) {
    return (
      <ConsentForm
        tipo={editing.tipo as ConsentTipo}
        editRecord={editing}
        onBack={() => {
          setEditing(null);
          refetch();
        }}
      />
    );
  }

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({
      tipo: tipoDraft || undefined,
      search: searchDraft.trim() || undefined,
      from: fromDraft || undefined,
      to: toDraft || undefined,
    });
  };

  const clearFilters = () => {
    setTipoDraft("");
    setSearchDraft("");
    setFromDraft("");
    setToDraft("");
    setFilters({});
  };

  const handleDownload = async (record: ConsentRecordDto) => {
    setActionError(null);
    setDownloadingId(record.id);
    try {
      const html = await buildRecordPdfHtml(record);
      const base64 = await htmlToPdfBase64(html);
      triggerPdfDownload(base64, `consentimiento-${record.tipo}-${record.numDoc}.pdf`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleAnular = async () => {
    if (!anularTarget) return;
    setAnulando(true);
    const { error } = await anularConsentApi(anularTarget.id);
    setAnulando(false);
    if (error) {
      setActionError(error);
      return;
    }
    setAnularTarget(null);
    refetch();
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen px-4 py-6 font-sans sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">Registros</h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              Consentimientos guardados: buscar, ver, descargar, editar o anular
            </p>
          </div>
        </div>

        {/* Filtros */}
        <form
          onSubmit={applyFilters}
          className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Tipo
            <select
              value={tipoDraft}
              onChange={(e) => setTipoDraft(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Todos</option>
              {CONSENT_TYPES.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
            Buscar (documento o nombre)
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Ej: 1020304050 o Juan Pérez"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Desde
            <input
              type="date"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Hasta
            <input
              type="date"
              value={toDraft}
              onChange={(e) => setToDraft(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#00c2a8] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="rounded-lg bg-[#00c2a8] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-95"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
          </div>
        </form>

        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {actionError}
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Documento</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No hay registros para estos filtros.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {tipoLabel(r.tipo)}
                        {r.entidad && <span className="ml-1 text-[11px] text-slate-400">({r.entidad})</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {r.tipoDoc} {r.numDoc}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {r.nombres} {r.apellidos ?? ""}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            ESTADO_BADGE[r.estado] ?? ESTADO_BADGE.borrador
                          }`}
                        >
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Ver"
                            aria-label="Ver"
                            onClick={() => setViewing(r)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Icon name="eye" size={16} />
                          </button>
                          <button
                            type="button"
                            title="Descargar PDF"
                            aria-label="Descargar PDF"
                            disabled={downloadingId === r.id}
                            onClick={() => handleDownload(r)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Icon name={downloadingId === r.id ? "clock" : "download"} size={16} />
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => setEditing(r)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            title="Anular"
                            aria-label="Anular"
                            disabled={r.estado === "anulado"}
                            onClick={() => setAnularTarget(r)}
                            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500 dark:text-slate-400">
          <span>
            {total === 0 ? "0 registros" : `Página ${page} de ${totalPages} · ${total} registro${total === 1 ? "" : "s"}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {viewing && <ConsentRecordViewModal record={viewing} onClose={() => setViewing(null)} />}

      {anularTarget && (
        <ConfirmModal
          title="Anular consentimiento"
          message={`¿Anular el consentimiento de <strong>${anularTarget.nombres} ${anularTarget.apellidos ?? ""}</strong> (${anularTarget.tipoDoc} ${anularTarget.numDoc})? Esta acción no se puede deshacer.`}
          confirmLabel="Anular"
          confirmColor="#ef4444"
          busy={anulando}
          onCancel={() => setAnularTarget(null)}
          onConfirm={handleAnular}
        />
      )}
    </div>
  );
}
