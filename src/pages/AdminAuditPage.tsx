import { useEffect, useMemo, useState } from "react";
import {
  getAdminAuditApi,
  type AdminAuditAction,
  type AdminAuditEntry,
  type AdminAuditTargetType,
} from "../services/api";
import type { UserRole } from "../types/auth.types";
import Avatar from "../components/common/Avatar";
import Icon from "../components/common/Icon";
import SelectMenu, { type SelectOption } from "../components/common/SelectMenu";
import { ROLE_COLORS } from "../components/users/UserListItem";

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  USER_CREATE: "Usuario creado",
  USER_UPDATE: "Usuario editado",
  USER_DELETE: "Usuario eliminado",
  USER_TOGGLE_ACTIVE: "Cambio activo",
  USER_PERMISSIONS_CHANGE: "Permisos modificados",
  USER_RESET_2FA: "2FA reiniciado",
  FORM_EDIT: "Formulario editado",
  FORM_DELETE: "Formulario eliminado",
  FORM_TOGGLE_PUBLIC: "Acceso público modificado",
  REPORT_REQUESTED: "Reporte solicitado",
  REPORT_DOWNLOADED: "Reporte descargado",
  REPORT_DOWNLOAD_FAILED: "Descarga de reporte fallida",
  SUBMISSION_PDF_VIEWED: "Vio PDF de registro",
  SUBMISSION_PDF_DOWNLOADED: "Descargó PDF de registro",
  SUBMISSION_DELETE: "Registro eliminado",
  SUBMISSIONS_BULK_PDF_REQUESTED: "Solicitó descarga masiva de PDFs",
  SUBMISSIONS_BULK_PDF_DOWNLOADED: "Descargó ZIP masivo de PDFs",
  SUBMISSIONS_BULK_PDF_FAILED: "Falló descarga de PDFs (2FA o TTL)",
  EXCEL_HEADERS_ACCESSED: "Leyó columnas de Excel (OneDrive)",
  EXCEL_SEARCH_PERFORMED: "Buscó en Excel (OneDrive)",
};

const ACTION_COLORS: Record<AdminAuditAction, string> = {
  USER_CREATE: "#10b981",
  USER_UPDATE: "#0891b2",
  USER_DELETE: "#dc2626",
  USER_TOGGLE_ACTIVE: "#f59e0b",
  USER_PERMISSIONS_CHANGE: "#7c3aed",
  USER_RESET_2FA: "#ea580c",
  FORM_EDIT: "#2563eb",
  FORM_DELETE: "#dc2626",
  FORM_TOGGLE_PUBLIC: "#0891b2",
  REPORT_REQUESTED: "#00c2a8",
  REPORT_DOWNLOADED: "#10b981",
  REPORT_DOWNLOAD_FAILED: "#dc2626",
  SUBMISSION_PDF_VIEWED: "#3b82f6",
  SUBMISSION_PDF_DOWNLOADED: "#0d9488",
  SUBMISSION_DELETE: "#dc2626",
  SUBMISSIONS_BULK_PDF_REQUESTED: "#7c3aed",
  SUBMISSIONS_BULK_PDF_DOWNLOADED: "#059669",
  SUBMISSIONS_BULK_PDF_FAILED: "#dc2626",
  EXCEL_HEADERS_ACCESSED: "#0d9488",
  EXCEL_SEARCH_PERFORMED: "#0891b2",
};

const TARGET_LABELS: Record<AdminAuditTargetType, string> = {
  USER: "Usuario",
  FORM: "Formulario",
  PROJECT: "Proyecto",
  FOLDER: "Carpeta",
  SUBMISSION: "Registro",
  EXCEL_FILE: "Excel (OneDrive)",
};

const PAGE_SIZE = 50;

/** Extrae un string `reason` de metadata (auditoría de eliminaciones). */
function getReason(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const r = (metadata as Record<string, unknown>).reason;
  return typeof r === "string" && r.trim().length > 0 ? r : null;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterAction, setFilterAction] = useState<AdminAuditAction | "">("");
  const [filterTargetType, setFilterTargetType] = useState<
    AdminAuditTargetType | ""
  >("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    setLoading(true);
    setError("");
    const res = await getAdminAuditApi({
      action: filterAction || undefined,
      targetType: filterTargetType || undefined,
      page,
      limit: PAGE_SIZE,
    });
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? "No se pudo cargar el log");
      return;
    }
    setEntries(res.data.data);
    setTotal(res.data.total);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction, filterTargetType]);

  // Reset a página 1 al cambiar filtros
  const onChangeAction = (v: string) => {
    setFilterAction(v as AdminAuditAction | "");
    setPage(1);
  };
  const onChangeTargetType = (v: string) => {
    setFilterTargetType(v as AdminAuditTargetType | "");
    setPage(1);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "medium",
      });
    } catch {
      return iso;
    }
  };

  const actionOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Todas" },
      ...(Object.keys(ACTION_LABELS) as AdminAuditAction[]).map((a) => ({
        value: a,
        label: ACTION_LABELS[a],
        color: ACTION_COLORS[a],
      })),
    ],
    [],
  );
  const targetOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Todos" },
      ...(Object.keys(TARGET_LABELS) as AdminAuditTargetType[]).map((t) => ({
        value: t,
        label: TARGET_LABELS[t],
      })),
    ],
    [],
  );

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="animate-fade-up mb-6 flex items-center gap-3 sm:gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.55)] sm:h-12 sm:w-12">
              <Icon name="eye" size={22} className="sm:hidden" />
              <Icon name="eye" size={24} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h1 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900 sm:text-[24px]">
                Reporte de acciones
              </h1>
              <p className="mt-0.5 text-[12.5px] text-gray-500 sm:text-[13px]">
                Bitácora de cambios de administradores.{" "}
                <span className="font-semibold text-gray-700">{total}</span>{" "}
                registro{total !== 1 ? "s" : ""} en total.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="animate-fade-up mb-5 flex flex-col gap-3 rounded-[20px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)] backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-end [animation-delay:60ms]">
            <div className="sm:min-w-[190px] sm:flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon name="tag" size={12} className="text-[#00c2a8]" /> Tipo de acción
              </label>
              <SelectMenu
                value={filterAction}
                onChange={onChangeAction}
                options={actionOptions}
                leftIcon="target"
              />
            </div>
            <div className="sm:min-w-[170px] sm:flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon name="folder" size={12} className="text-[#00c2a8]" /> Tipo de objeto
              </label>
              <SelectMenu
                value={filterTargetType}
                onChange={onChangeTargetType}
                options={targetOptions}
                leftIcon="folder"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterAction("");
                  setFilterTargetType("");
                  setPage(1);
                }}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-white px-3.5 py-2.5 text-[12px] font-semibold text-gray-600 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-900 sm:flex-none"
              >
                <Icon name="x" size={14} /> Limpiar
              </button>
              <button
                onClick={load}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] sm:flex-none"
              >
                <Icon name="refresh" size={14} /> Refrescar
              </button>
            </div>
          </div>

          {/* Listado */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-gray-400">
              <Icon name="refresh" size={16} className="animate-spin" /> Cargando...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 rounded-[20px] border border-red-200 bg-red-50 p-10 text-center text-[13px] font-medium text-red-600">
              <Icon name="alert" size={16} className="shrink-0" /> {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon name="fileText" size={26} />
              </div>
              <p className="text-[15px] font-bold text-slate-700">Sin registros</p>
              <p className="mt-1 text-[13px] text-gray-400">
                No hay acciones que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <>
              {/* Móvil: tarjetas apiladas */}
              <div className="animate-fade-up space-y-3 sm:hidden [animation-delay:120ms]">
                {entries.map((e) => {
                  const expanded = expandedId === e.id;
                  const actionColor = ACTION_COLORS[e.action] ?? "#64748b";
                  return (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_20px_-14px_rgba(15,40,80,0.3)]"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ background: `${actionColor}14`, color: actionColor }}
                        >
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: actionColor }}
                          />
                          {ACTION_LABELS[e.action] ?? e.action}
                        </span>
                        <span className="flex-shrink-0 text-right text-[11px] text-gray-400 tabular-nums">
                          {formatDate(e.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={e.actorName}
                          size={32}
                          color={ROLE_COLORS[e.actorRole as UserRole] ?? "#00c2a8"}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-gray-900">
                            {e.actorName}
                          </div>
                          <div className="text-[10.5px] uppercase tracking-wide text-gray-400">
                            {e.actorRole}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {TARGET_LABELS[e.targetType] ?? e.targetType} #{e.targetId}
                        </div>
                        <div className="text-[13px] font-semibold text-gray-900">
                          {e.targetName ?? <span className="text-gray-400">(sin nombre)</span>}
                        </div>
                      </div>

                      {getReason(e.metadata) && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            Motivo
                          </div>
                          <div className="mt-0.5 text-[12px] italic text-red-800">
                            "{getReason(e.metadata)}"
                          </div>
                        </div>
                      )}

                      {e.metadata && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedId(expanded ? null : e.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#00c2a8]/40 hover:text-[#0891b2]"
                          >
                            <Icon name="eye" size={12} />
                            {expanded ? "Ocultar detalle" : "Ver detalle"}
                          </button>
                          {expanded && (
                            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-left font-mono text-[10.5px] leading-relaxed text-slate-100 shadow-inner">
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Escritorio: tabla */}
              <div className="animate-fade-up hidden overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)] sm:block [animation-delay:120ms]">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Actor</th>
                        <th className="px-4 py-3">Acción</th>
                        <th className="px-4 py-3">Objeto</th>
                        <th className="px-4 py-3 text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => {
                        const expanded = expandedId === e.id;
                        const actionColor = ACTION_COLORS[e.action] ?? "#64748b";
                        return (
                          <tr
                            key={e.id}
                            className="border-b border-slate-100 align-top transition-colors last:border-b-0 hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums">
                              {formatDate(e.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar
                                  name={e.actorName}
                                  size={30}
                                  color={ROLE_COLORS[e.actorRole as UserRole] ?? "#00c2a8"}
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-gray-900">
                                    {e.actorName}
                                  </div>
                                  <div className="text-[10.5px] uppercase tracking-wide text-gray-400">
                                    {e.actorRole}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                style={{
                                  background: `${actionColor}14`,
                                  color: actionColor,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                  style={{ background: actionColor }}
                                />
                                {ACTION_LABELS[e.action] ?? e.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">
                                {e.targetName ?? <span className="text-gray-400">(sin nombre)</span>}
                              </div>
                              {getReason(e.metadata) && (
                                <div className="mt-1 max-w-[320px] rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] italic text-red-800">
                                  Motivo: "{getReason(e.metadata)}"
                                </div>
                              )}
                              <div className="text-[10.5px] text-gray-400">
                                {TARGET_LABELS[e.targetType] ?? e.targetType} #{e.targetId}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {e.metadata ? (
                                <button
                                  onClick={() =>
                                    setExpandedId(expanded ? null : e.id)
                                  }
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#00c2a8]/40 hover:text-[#0891b2]"
                                >
                                  <Icon name="eye" size={12} />
                                  {expanded ? "Ocultar" : "Ver"}
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-300">—</span>
                              )}
                              {expanded && e.metadata && (
                                <pre className="mt-2 max-w-[400px] overflow-x-auto rounded-lg bg-slate-900 p-3 text-left font-mono text-[10.5px] leading-relaxed text-slate-100 shadow-inner">
                                  {JSON.stringify(e.metadata, null, 2)}
                                </pre>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Paginación */}
          {!loading && entries.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-gray-600">
              <div>
                Página <span className="font-semibold text-gray-800">{page}</span> de{" "}
                <span className="font-semibold text-gray-800">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition hover:border-slate-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-gray-600"
                >
                  <Icon name="chevronRight" size={13} className="rotate-180" /> Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition hover:border-slate-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-gray-600"
                >
                  Siguiente <Icon name="chevronRight" size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
