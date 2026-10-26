import { useEffect, useState } from "react";
import { getMyTasksApi, type MyTaskItem } from "../../services/api";
import Icon from "../common/Icon";

const STATUS_CFG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  in_progress: { bg: "#dcfce7", color: "#065f46", label: "Tu turno" },
  waiting: { bg: "#dbeafe", color: "#1e40af", label: "En espera" },
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
};
const STATUS_FALLBACK = {
  bg: "#f1f5f9",
  color: "#475569",
  label: "Desconocido",
};

function StatusBadge({ status }: { status?: MyTaskItem["myStatus"] }) {
  const cfg = (status && STATUS_CFG[status]) || STATUS_FALLBACK;
  return (
    <span
      className="rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export default function MyTasksList() {
  const [tasks, setTasks] = useState<MyTaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await getMyTasksApi();
      if (!cancelled) {
        setTasks(data ?? []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openTask = (token: string) => {
    window.location.href = `/task/${token}`;
  };

  if (loading) {
    return (
      <div className="px-6 py-20 text-center text-sm text-slate-400">
        Cargando tareas…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="animate-fade-up px-6 py-20 text-center text-slate-400">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="inbox" size={30} />
        </div>
        <p className="text-lg font-extrabold tracking-tight text-slate-800">
          No tienes tareas pendientes
        </p>
        <p className="mt-1 text-[13px] text-slate-400">
          Cuando alguien te asigne una tarea aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      {tasks.map((t, i) => {
        // Defensivos: si el backend devuelve un shape antiguo o algún campo
        // viene undefined, evitamos romper la UI completa.
        const myStep = t.myStepOrder ?? 1;
        const total = t.totalSteps ?? Math.max(myStep, 1);
        const current = t.currentStepOrder ?? myStep;
        const isMine = t.myStatus === "in_progress";
        const progressPct = Math.min(
          100,
          Math.max(0, Math.round(((current - 1) / total) * 100)),
        );
        return (
          <div
            key={t.taskId + (t.token || myStep)}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,40,80,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(15,40,80,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={t.myStatus} />
                  <span className="text-[11px] text-slate-400">
                    Tu paso: {myStep} de {total}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    · Paso activo: {current}/{total}
                  </span>
                </div>
                <h3 className="m-0 truncate text-sm font-bold text-slate-900">
                  {t.title}
                </h3>
                <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                  <Icon name="clipboard" size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">{t.formName}</span>
                </p>
                {t.description && (
                  <p className="m-0 mt-1.5 text-[12px] leading-snug text-slate-600">
                    {t.description}
                  </p>
                )}

                {/* Barra de progreso */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-[#00c2a8] to-[#0891b2] transition-[width]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {!isMine && t.waitingForName && (
                  <p className="m-0 mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Icon name="clock" size={12} className="shrink-0 text-slate-400" />
                    <span>
                      Esperando a <strong>{t.waitingForName}</strong>
                      {t.waitingForEmail && ` (${t.waitingForEmail})`}
                    </span>
                  </p>
                )}

                <p className="m-0 mt-2 text-[10px] text-slate-400">
                  Creada{" "}
                  {new Date(t.createdAt).toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              {isMine && t.token && (
                <button
                  onClick={() => openTask(t.token)}
                  className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.65)]"
                >
                  <Icon name="edit" size={13} /> Continuar →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
