import { useEffect, useState } from "react";
import {
  getMySubmissionsApi,
  type MySubmissionItem,
} from "../../services/api";
import { useFolderStore } from "../../store/useFolderStore";
import { useProjectStore } from "../../store/useProjectStore";

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
        ⏳ Cargando envíos...
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="px-6 py-20 text-center text-slate-400">
        <div className="mb-3 text-5xl">📤</div>
        <p className="text-base font-semibold">Aún no has enviado formularios</p>
        <p className="mt-1 text-[13px]">
          Cuando envíes un formulario aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      {subs.map((s) => {
        const date = new Date(s.submittedAt);
        return (
          <div
            key={s.id}
            className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    ✓ Enviado
                  </span>
                  <span className="text-[11px] text-slate-400">
                    v{s.formVersion}
                  </span>
                </div>
                <h3 className="m-0 truncate text-sm font-bold text-slate-900">
                  📋 {formNameById(s.formId)}
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
