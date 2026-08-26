import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { widgetRegistry } from "../components/widgets/registry";
import { evaluateRules } from "../utils/formRules";
import { generateExcelHtml } from "../utils/excelToHtml";
import { htmlToPdfBase64 } from "../utils/pdfExporter";
import { expandFormData, renderFilename } from "../utils/placeholders";
import MissingFieldsModal from "../components/form/MissingFieldsModal";
import type { EmailTemplate } from "../types/email-template.types";
import type { FormRule, WidgetInstance } from "../types/widget.types";

type Attachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type TaskData = {
  taskId: string;
  title: string;
  description?: string;
  formName: string;
  widgets: WidgetInstance[];
  rules?: FormRule[];
  prefilledData: Record<string, string>;
  stepIndex: number;
  totalSteps: number;
  stepOrder: number;
  recipientName: string;
  recipientEmail: string;
  emailTemplate?: EmailTemplate | null;
  previousStepsData?: Record<string, string>;
};

type PageState =
  | "loading"
  | "ready"
  | "submitting"
  | "done"
  | "error"
  | "already_completed";

type Result = { completed: boolean; nextEmail?: string };

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4 font-sans">
      {children}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[440px] rounded-2xl bg-white px-8 py-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)] sm:px-10 sm:py-12">
      <div className="mb-4 text-5xl sm:text-[56px]">{icon}</div>
      {title && (
        <h2 className="m-0 mb-2 text-lg font-bold text-gray-900 sm:text-xl">
          {title}
        </h2>
      )}
      <div className="text-sm text-gray-500">{children}</div>
    </div>
  );
}

// ← NUEVO: inyecta prefilledData en config.defaultValue de cada widget
function injectPrefill(
  widgets: WidgetInstance[],
  prefilledData: Record<string, string>,
): WidgetInstance[] {
  return widgets.map((w) => {
    const prefilled = prefilledData[w.id];
    if (!prefilled) return w;
    return {
      ...w,
      config: {
        ...w.config,
        defaultValue: prefilled,
      },
    };
  });
}

/**
 * Para tareas multi-paso con firmas asignadas: un widget con
 * `config.assignedStep > stepOrder` aún no le toca al destinatario actual
 * → se oculta. Si está vacío o en 0, significa "cualquier paso".
 */
function isWidgetVisibleForStep(
  w: WidgetInstance,
  currentStepOrder: number,
): boolean {
  const assigned = (w.config?.assignedStep as number | undefined) ?? 0;
  if (!assigned || assigned <= 0) return true;
  return assigned <= currentStepOrder;
}

// La normalización y la expansión de subformularios viven en
// utils/placeholders.ts — aquí solo delegamos para que TaskPage y FormPage
// generen exactamente las mismas claves a partir de los mismos datos.
function buildLabeledData(
  widgets: WidgetInstance[],
  data: Record<string, string>,
  hiddenIds: Set<string>,
): Record<string, string> {
  return expandFormData(widgets, data, hiddenIds);
}

async function collectPdfAttachments(
  template: EmailTemplate,
  labeledData: Record<string, string>,
  attachments: { name: string; contentType: string; contentBytes: string }[],
): Promise<void> {
  // Excel mapeado → PDF
  if (template.excelBase64 && (template.excelMappings?.length ?? 0) > 0) {
    const html = generateExcelHtml(
      template.excelBase64,
      template.excelMappings!,
      labeledData,
      template.excelLogoBase64,
    );
    if (html) {
      const base64 = await htmlToPdfBase64(html);
      attachments.push({
        name:
          template.excelFilename?.replace(/\.xlsx?$/i, ".pdf") ??
          "formulario.pdf",
        contentType: "application/pdf",
        contentBytes: base64,
      });
    }
  }

  // PDF desde plantilla HTML
  if (template.attachPDF && template.pdfTemplate?.trim()) {
    const filled = template.pdfTemplate.replace(
      /\$\{([^}]+)\}/g,
      (_: string, key: string) => {
        const raw = labeledData[key] ?? "";
        if (raw.startsWith("data:image/")) {
          return `<img src="${raw}" style="max-height:80px;max-width:100%;object-fit:contain;display:block;">`;
        }
        return raw;
      },
    );
    const base64 = await htmlToPdfBase64(filled);
    attachments.push({
      name: renderFilename(template.pdfFilename, labeledData),
      contentType: "application/pdf",
      contentBytes: base64,
    });
  }
}

export default function TaskPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [task, setTask] = useState<TaskData | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Token inválido");
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/tasks/public/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          if (
            typeof body.message === "string" &&
            body.message.includes("ya fue completado")
          ) {
            setState("already_completed");
          } else {
            setState("error");
            setErrorMsg(body.message || "Error cargando la tarea");
          }
          return;
        }
        // Combinar lo que el admin prediligenció + lo que llenaron pasos
        // anteriores. Lo de pasos previos gana porque es más reciente.
        const taskData = body as TaskData;
        const heritage: Record<string, string> = {
          ...(taskData.prefilledData ?? {}),
          ...(taskData.previousStepsData ?? {}),
        };
        taskData.widgets = injectPrefill(taskData.widgets, heritage);
        setTask(taskData);
        setFieldValues(heritage);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setErrorMsg("Error de conexión");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const hiddenIds = useMemo(
    () => evaluateRules(task?.rules ?? [], fieldValues),
    [task?.rules, fieldValues],
  );

  const visibleWidgets = useMemo(
    () =>
      (task?.widgets ?? []).filter(
        (w) =>
          !hiddenIds.has(w.id) &&
          isWidgetVisibleForStep(w, task?.stepOrder ?? 0),
      ),
    [task?.widgets, hiddenIds, task?.stepOrder],
  );

  const collectFieldValue = (fd: FormData, name: string): string => {
    // getAll cubre checkbox múltiples; para inputs únicos devuelve [valor].
    const vals = fd.getAll(name);
    if (vals.length === 0) return "";
    return vals.map(String).join(",");
  };

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    (task?.widgets ?? []).forEach((w) => {
      next[w.id] = collectFieldValue(fd, w.id);
    });
    setFieldValues(next);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !task) return;

    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    task.widgets.forEach((w) => {
      if (hiddenIds.has(w.id)) return;
      // Si el widget está asignado a un paso futuro no toca tocarlo: no
      // mandamos su valor para no pisar el del paso real cuando llegue.
      if (!isWidgetVisibleForStep(w, task.stepOrder)) return;
      data[w.id] = collectFieldValue(fd, w.id);
    });

    // Validación explícita de required. HTML5 no valida inputs hidden
    // (Signature, IdScanner) ni widgets que no tienen <input> (Photo),
    // así que verificamos cada campo obligatorio contra el valor recolectado.
    // Solo validamos required en los widgets que le tocan a este paso.
    const missing: string[] = [];
    task.widgets.forEach((w) => {
      if (!w.required || hiddenIds.has(w.id)) return;
      if (!isWidgetVisibleForStep(w, task.stepOrder)) return;
      const assigned = (w.config?.assignedStep as number | undefined) ?? 0;
      // Firmas heredadas de un paso anterior no se piden de nuevo al actual.
      if (assigned > 0 && assigned < task.stepOrder) return;
      const value = (data[w.id] ?? "").trim();
      if (!value) missing.push(w.label);
    });
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setState("submitting");

    // Solo en el último paso generamos los PDFs en el cliente y los
    // mandamos al backend. Pasos intermedios no llevan attachments.
    const isLast = task.stepOrder === task.totalSteps;
    const attachments: Attachment[] = [];
    const template = task.emailTemplate;
    if (import.meta.env.DEV) {
      // Solo en dev — evita exponer metadata del template en consoles
      // remotas de iPhone/iPad de usuarios reales.
      console.log("[TaskPage] submit", {
        isLast,
        stepOrder: task.stepOrder,
        totalSteps: task.totalSteps,
        hasTemplate: !!template,
        templateEnabled: template?.enabled,
        hasExcel: !!template?.excelBase64,
        excelMappings: template?.excelMappings?.length ?? 0,
        hasPdfTemplate: !!template?.pdfTemplate,
        attachPDF: template?.attachPDF,
      });
    }
    if (isLast && template?.enabled) {
      const combined: Record<string, string> = {
        ...(task.previousStepsData ?? {}),
        ...data,
      };
      const labeled = buildLabeledData(task.widgets, combined, hiddenIds);
      try {
        await collectPdfAttachments(template, labeled, attachments);
        if (import.meta.env.DEV) {
          // Los nombres de archivo suelen incluir nombre del paciente/tarea:
          // PII que no queremos en consoles remotas de producción.
          console.log(
            `[TaskPage] PDFs generados: ${attachments.length}`,
            attachments.map((a) => ({ name: a.name, sizeKB: Math.round(a.contentBytes.length / 1024) })),
          );
        }
      } catch (e) {
        console.error("[TaskPage] Error generando PDFs en último paso:", e);
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/tasks/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data, attachments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState("error");
        setErrorMsg(err.message || "Error al enviar");
        return;
      }
      setResult(await res.json());
      setState("done");
    } catch {
      setState("error");
      setErrorMsg("Error de conexión al enviar");
    }
  };

  if (state === "loading") {
    return (
      <PageShell>
        <div className="text-center text-gray-500">
          <div className="mb-4 text-5xl">⏳</div>
          <p className="text-base">Cargando formulario...</p>
        </div>
      </PageShell>
    );
  }

  if (state === "already_completed") {
    return (
      <PageShell>
        <StatusCard icon="✅" title="Ya completaste este paso">
          Este enlace ya fue utilizado. Gracias por tu participación.
        </StatusCard>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <StatusCard icon="⚠️" title="Error">
          {errorMsg}
        </StatusCard>
      </PageShell>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 font-sans">
        <div className="w-full max-w-[480px] rounded-[20px] bg-white px-9 py-12 text-center shadow-[0_12px_40px_rgba(0,194,168,0.15)] sm:px-11">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00c2a8] to-emerald-600 text-[38px]">
            ✅
          </div>
          <h2 className="m-0 mb-2.5 text-[22px] font-bold text-gray-900">
            ¡Completado!
          </h2>
          {result.completed ? (
            <p className="text-sm leading-relaxed text-gray-500">
              Todos los participantes han completado el formulario. El documento
              ha sido generado y guardado.
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-gray-500">
                Tu parte ha sido enviada correctamente. El siguiente participante
                recibirá una notificación por email para continuar.
              </p>
              {result.nextEmail && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
                  📧 Notificación enviada a: <strong>{result.nextEmail}</strong>
                </div>
              )}
            </>
          )}
          <p className="mt-6 text-xs text-gray-400">Puedes cerrar esta ventana</p>
        </div>
      </div>
    );
  }

  if (!task) return null;

  const submitting = state === "submitting";
  const isLastStep = task.stepOrder === task.totalSteps;
  const progressPct = (task.stepOrder / task.totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#f0f4f8] px-4 py-6 font-sans sm:py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-t-2xl bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-6 py-6 text-white sm:px-7 sm:py-7">
          <div className="mb-1 text-xs opacity-80">
            Paso {task.stepOrder} de {task.totalSteps} · {task.formName}
          </div>
          <h1 className="m-0 mb-1.5 text-xl font-extrabold leading-tight sm:text-[22px]">
            {task.title}
          </h1>
          {task.description && (
            <p className="m-0 text-sm opacity-85">{task.description}</p>
          )}
          <div className="mt-3 text-[13px] opacity-70">
            Hola, <strong>{task.recipientName}</strong>
          </div>
        </div>

        <div className="h-1 bg-slate-200">
          <div
            className="h-1 bg-[#00c2a8] transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="rounded-b-2xl bg-white px-5 py-7 shadow-[0_4px_20px_rgba(0,0,0,0.08)] sm:px-7">
          <form onSubmit={handleSubmit} onChange={handleFormChange}>
            <div className="flex flex-col gap-[18px]">
              {visibleWidgets.length === 0 ? (
                <p className="text-center text-sm text-gray-400">
                  Sin campos visibles
                </p>
              ) : (
                visibleWidgets.map((widget) => {
                  const RenderComponent = widgetRegistry[widget.type]?.render;
                  if (!RenderComponent) return null;
                  const fromAdmin = (task.prefilledData[widget.id] ?? "").trim();
                  const fromPrev = (
                    task.previousStepsData?.[widget.id] ?? ""
                  ).trim();
                  const origin: "admin" | "prev" | "none" = fromPrev
                    ? "prev"
                    : fromAdmin
                    ? "admin"
                    : "none";
                  const hasValue = origin !== "none";
                  return (
                    <div
                      key={widget.id}
                      className="rounded-[10px] border-[1.5px] px-4 py-3.5 transition-opacity"
                      style={{
                        background: hasValue ? "#f0fdf4" : "#f8fafc",
                        borderColor: hasValue ? "#bbf7d0" : "#e2e8f0",
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      {origin === "admin" && (
                        <div className="mb-1 text-[10px] font-bold uppercase text-emerald-600">
                          ✓ Prediligenciado
                        </div>
                      )}
                      {origin === "prev" && (
                        <div className="mb-1 text-[10px] font-bold uppercase text-emerald-600">
                          ✓ Diligenciado en un paso anterior
                        </div>
                      )}
                      <RenderComponent widget={widget} />
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[10px] border-none px-8 py-3 text-[15px] font-bold text-white transition-all sm:w-auto"
                style={{
                  background: submitting ? "#94a3b8" : "#00c2a8",
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting
                    ? "none"
                    : "0 4px 14px rgba(0,194,168,0.4)",
                }}
              >
                {submitting
                  ? "Enviando..."
                  : isLastStep
                  ? "✅ Completar y enviar"
                  : "Enviar y continuar →"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-400">
          🔒 Este formulario es de uso exclusivo para {task.recipientEmail}
        </p>
      </div>

      {missingFields.length > 0 && (
        <MissingFieldsModal
          fields={missingFields}
          onClose={() => setMissingFields([])}
        />
      )}
    </div>
  );
}