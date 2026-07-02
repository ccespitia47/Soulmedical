import { useEffect, useMemo, useState } from "react";
import {
  getAdminAuditApi,
  type AdminAuditAction,
  type AdminAuditEntry,
  type AdminAuditTargetType,
} from "../services/api";

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  USER_CREATE: "Usuario creado",
  USER_UPDATE: "Usuario editado",
  USER_DELETE: "Usuario eliminado",
  USER_TOGGLE_ACTIVE: "Cambio activo",
  USER_PERMISSIONS_CHANGE: "Permisos modificados",
  USER_RESET_2FA: "2FA reiniciado",
  FORM_DELETE: "Formulario eliminado",
  FORM_TOGGLE_PUBLIC: "Acceso público modificado",
  REPORT_REQUESTED: "Reporte solicitado",
  REPORT_DOWNLOADED: "Reporte descargado",
  REPORT_DOWNLOAD_FAILED: "Descarga de reporte fallida",
};

const ACTION_COLORS: Record<AdminAuditAction, string> = {
  USER_CREATE: "#10b981",
  USER_UPDATE: "#0891b2",
  USER_DELETE: "#dc2626",
  USER_TOGGLE_ACTIVE: "#f59e0b",
  USER_PERMISSIONS_CHANGE: "#7c3aed",
  USER_RESET_2FA: "#ea580c",
  FORM_DELETE: "#dc2626",
  FORM_TOGGLE_PUBLIC: "#0891b2",
  REPORT_REQUESTED: "#00c2a8",
  REPORT_DOWNLOADED: "#10b981",
  REPORT_DOWNLOAD_FAILED: "#dc2626",
};

const TARGET_LABELS: Record<AdminAuditTargetType, string> = {
  USER: "Usuario",
  FORM: "Formulario",
  PROJECT: "Proyecto",
  FOLDER: "Carpeta",
};

const PAGE_SIZE = 50;

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

  const actionOptions = useMemo(
    () => Object.keys(ACTION_LABELS) as AdminAuditAction[],
    [],
  );
  const targetOptions = useMemo(
    () => Object.keys(TARGET_LABELS) as AdminAuditTargetType[],
    [],
  );

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-8">
          <div className="mb-6">
            <h1 className="m-0 text-[22px] font-bold text-gray-900">
              🕵️ Reporte de acciones
            </h1>
            <p className="mt-1 text-[13px] text-gray-500">
              Bitácora de cambios realizados por administradores. {total}{" "}
              registro{total !== 1 ? "s" : ""} en total.
            </p>
          </div>

          {/* Filtros */}
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tipo de acción
              </label>
              <select
                value={filterAction}
                onChange={(e) => onChangeAction(e.target.value)}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] text-gray-900 outline-none"
              >
                <option value="">Todas</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tipo de objeto
              </label>
              <select
                value={filterTargetType}
                onChange={(e) => onChangeTargetType(e.target.value)}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] text-gray-900 outline-none"
              >
                <option value="">Todos</option>
                {targetOptions.map((t) => (
                  <option key={t} value={t}>
                    {TARGET_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setFilterAction("");
                setFilterTargetType("");
                setPage(1);
              }}
              className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 hover:bg-slate-50"
            >
              Limpiar
            </button>
            <button
              onClick={load}
              className="cursor-pointer rounded-md border-none bg-[#00c2a8] px-4 py-2 text-[12px] font-semibold text-white"
            >
              ↻ Refrescar
            </button>
          </div>

          {/* Listado */}
          {loading ? (
            <div className="px-6 py-14 text-center text-gray-400">
              Cargando...
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-600">{error}</div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
              <span className="mb-3 block text-5xl">🗒️</span>
              <p className="text-[15px] font-semibold">Sin registros</p>
              <p className="text-[13px]">
                No hay acciones que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Actor</th>
                    <th className="px-3 py-2.5">Acción</th>
                    <th className="px-3 py-2.5">Objeto</th>
                    <th className="px-3 py-2.5 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const expanded = expandedId === e.id;
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">
                          {formatDate(e.createdAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-gray-900">
                            {e.actorName}
                          </div>
                          <div className="text-[10.5px] uppercase tracking-wide text-gray-400">
                            {e.actorRole}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              background: `${ACTION_COLORS[e.action] ?? "#64748b"}18`,
                              color: ACTION_COLORS[e.action] ?? "#64748b",
                            }}
                          >
                            {ACTION_LABELS[e.action] ?? e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-gray-900">
                            {e.targetName ?? <span className="text-gray-400">(sin nombre)</span>}
                          </div>
                          <div className="text-[10.5px] text-gray-400">
                            {TARGET_LABELS[e.targetType] ?? e.targetType} #{e.targetId}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {e.metadata ? (
                            <button
                              onClick={() =>
                                setExpandedId(expanded ? null : e.id)
                              }
                              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-slate-50"
                            >
                              {expanded ? "Ocultar" : "Ver"}
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                          {expanded && e.metadata && (
                            <pre className="mt-2 max-w-[400px] overflow-x-auto rounded-md bg-slate-900 p-2.5 text-left font-mono text-[10.5px] text-slate-100">
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
          )}

          {/* Paginación */}
          {!loading && entries.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-gray-600">
              <div>
                Página {page} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
