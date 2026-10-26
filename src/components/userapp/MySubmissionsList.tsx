import { useEffect, useState } from "react";
import {
  getMySubmissionsApi,
  type MySubmissionItem,
} from "../../services/api";
import { useFolderStore } from "../../store/useFolderStore";
import { useProjectStore } from "../../store/useProjectStore";
import Icon from "../common/Icon";

export default function MySubmissionsList() {
  const [subs, setSubs] = useState<MySubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { folders, loadFolders } = useFolderStore();
  const { projects, loadProjects } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      Promise.all(projects.map((p) => loadFolders(p.id)));
    }
  }, [projects.length]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await getMySubmissionsApi();
      if (!cancelled) {
        setSubs(data?.data ?? []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const formNameById = (formId: string): string => {
    for (const folder of folders) {
      const form = folder.forms.find((f) => f.id === formId);
      if (form) return form.name;
    }
    return "Formulario eliminado";
  };

  if (loading) {
    return (
      <div className="px-6 py-20 text-center text-sm text-slate-400">
        Cargando envíos…
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="animate-fade-up px-6 py-20 text-center text-slate-400">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
          <Icon name="send" size={28} />
        </div>
        <p className="text-lg font-extrabold tracking-tight text-slate-800">
          Aún no has enviado formularios
        </p>
        <p className="mt-1 text-[13px] text-slate-400">
          Cuando envíes un formulario aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      {subs.map((s, i) => {
        const date = new Date(s.submittedAt);
        return (
          <div
            key={s.id}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,40,80,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(15,40,80,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    <Icon name="checkCircle" size={11} /> Enviado
                  </span>
                  <span className="text-[11px] text-slate-400">
                    v{s.formVersion}
                  </span>
                </div>
                <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Icon name="clipboard" size={14} className="shrink-0 text-emerald-500" />
                  <span className="truncate">{formNameById(s.formId)}</span>
                </h3>
                <p className="m-0 mt-1 text-[12px] text-slate-500">
                  {date.toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {date.toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="m-0 mt-1.5 text-[11px] text-slate-400">
                  {Object.keys(s.data).length} campo
                  {Object.keys(s.data).length !== 1 ? "s" : ""} diligenciado
                  {Object.keys(s.data).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
