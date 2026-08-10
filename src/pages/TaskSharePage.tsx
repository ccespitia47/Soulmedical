import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { widgetRegistry } from "../components/widgets/registry";
import { evaluateRules } from "../utils/formRules";
import type { WidgetInstance, FormRule } from "../types/widget.types";

// getAll cubre checkbox múltiples; para inputs únicos devuelve [valor].
const collectFieldValue = (fd: FormData, name: string): string => {
  const vals = fd.getAll(name);
  if (vals.length === 0) return "";
  return vals.map(String).filter((v) => v !== "").join(",");
};

const API_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

type ShareData = {
  formName: string;
  widgets: WidgetInstance[];
  rules: FormRule[];
  prefilledData: Record<string, string>;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ShareData }
  | { kind: "submitting"; data: ShareData }
  | { kind: "done"; data: ShareData }; // permite refrescar

export default function TaskSharePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/tasks/share/${token}`)
      .then(async (r) => {
        if (r.status === 404) {
          setState({ kind: "error", message: "Este enlace no es válido o fue desactivado." });
          return;
        }
        if (!r.ok) {
          setState({ kind: "error", message: `Error ${r.status} al cargar el formulario.` });
          return;
        }
        const data: ShareData = await r.json();
        setState({ kind: "ready", data });
        setFieldValues(data.prefilledData ?? {});
      })
      .catch(() => setState({ kind: "error", message: "No se pudo conectar con el servidor." }));
  }, [token]);

  const rules: FormRule[] =
    state.kind === "ready" || state.kind === "submitting" || state.kind === "done"
      ? state.data.rules
      : [];
  const hiddenIds = useMemo(
    () => evaluateRules(rules, fieldValues),
    [rules, fieldValues],
  );

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    if (state.kind !== "ready") return;
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    state.data.widgets.forEach((w) => {
      next[w.id] = collectFieldValue(fd, w.id);
    });
    setFieldValues(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "ready" || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const data: Record<string, string> = {};
    state.data.widgets.forEach((w) => {
      if (hiddenIds.has(w.id)) return;
      data[w.id] = collectFieldValue(fd, w.id);
    });
    setState({ kind: "submitting", data: state.data });
    try {
      const res = await fetch(`${API_URL}/tasks/share/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setState({ kind: "done", data: state.data });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  const resetForm = () => {
    if (state.kind === "done") setState({ kind: "ready", data: state.data });
  };

  if (state.kind === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Cargando…</div>;
  }
  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-5">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-3 text-5xl">⚠️</div>
          <p className="text-[15px] font-semibold text-gray-900">{state.message}</p>
        </div>
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-5">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-3 text-5xl">✅</div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">¡Enviado!</h2>
          <p className="mb-5 text-[13px] text-gray-500">
            Puedes llenar el formulario de nuevo o cerrar la pestaña.
          </p>
          <button
            onClick={resetForm}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2 text-[13px] font-bold text-white"
          >
            Llenar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const { data } = state;
  return (
    <div className="min-h-screen bg-[#f0f4f8] px-4 py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-2xl bg-white px-6 py-7 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <h1 className="mb-6 border-b-2 border-[#00c2a8] pb-[18px] text-[22px] font-bold text-gray-900">
            {data.formName}
          </h1>
          <form ref={formRef} onSubmit={handleSubmit} onChange={handleFormChange}>
            <div className="flex flex-col gap-[18px]">
              {data.widgets.filter((w) => !hiddenIds.has(w.id)).map((widget) => {
                const RenderComponent = widgetRegistry[widget.type]?.render;
                if (!RenderComponent) return null;
                // Aplicar prefilledData vía defaultValue del widget instance.
                const widgetWithPrefill: WidgetInstance = {
                  ...widget,
                  config: {
                    ...widget.config,
                    defaultValue: data.prefilledData[widget.id] ?? widget.config?.defaultValue,
                  },
                };
                return (
                  <div key={widget.id} className="rounded-[10px] border border-slate-200 bg-gray-50 p-4">
                    <RenderComponent widget={widgetWithPrefill} />
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end border-t border-gray-200 pt-5">
              <button
                type="submit"
                disabled={state.kind === "submitting"}
                className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-6 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.kind === "submitting" ? "Enviando…" : "📤 Enviar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
