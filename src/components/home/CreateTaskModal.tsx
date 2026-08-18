import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useFolderStore } from "../../store/useFolderStore";
import { getGroupsApi, getUsersApi, toggleTaskShareLinkApi, type GroupData } from "../../services/api";
import type { FormRule, WidgetInstance } from "../../types/widget.types";
import { evaluateRules } from "../../utils/formRules";
import Icon from "../common/Icon";
import InfoTab from "./taskBuilder/InfoTab";
import PrefillTab from "./taskBuilder/PrefillTab";
import StepsTab from "./taskBuilder/StepsTab";
import { useTaskSteps } from "./taskBuilder/useTaskSteps";
import type { SimpleUser } from "./taskBuilder/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type CreateTaskModalProps = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  rules?: FormRule[];
  onClose: () => void;
  onCreated: () => void;
};

type Tab = "info" | "prefill" | "steps";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "info", label: "Información", icon: "fileText" },
  { id: "prefill", label: "Prediligenciar", icon: "edit" },
  { id: "steps", label: "Destinatarios", icon: "users" },
];

export default function CreateTaskModal({
  formId,
  folderId,
  formName,
  widgets,
  rules = [],
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const token = useAuthStore((s) => s.token);
  const folders = useFolderStore((s) => s.folders);
  const prefillFormRef = useRef<HTMLFormElement>(null);

  const [tab, setTab] = useState<Tab>("info");
  const [title, setTitle] = useState(`Tarea — ${formName}`);
  const [description, setDescription] = useState("");
  const [prefilledData, setPrefilledData] = useState<Record<string, string>>({});
  // Reglas de visibilidad aplicadas también al prediligenciar (igual que en la
  // tarea/enlace): los campos ocultos por reglas no se muestran ni se prellenan.
  const prefillHiddenIds = evaluateRules(rules, prefilledData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [taskCreated, setTaskCreated] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [oneShotLink, setOneShotLink] = useState(false);

  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  // Bump para forzar remount del <input type="checkbox"> del link cuando
  // necesitamos que el DOM revierta al valor real de shareEnabled (cancel
  // del confirm, error del PATCH). Sin esto React 18 hace bail-out con
  // Object.is y el DOM queda visualmente inconsistente con el estado.
  const [shareCheckboxKey, setShareCheckboxKey] = useState(0);

  const stepsCtl = useTaskSteps(allUsers);

  // Mapa stepNumber → array de etiquetas de firma. Solo firmas con
  // assignedStep > 0 cuentan. El admin verá un destinatario por cada
  // paso, alineado con la firma que debe completar.
  const signaturesByStep = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const w of widgets) {
      if (w.type !== "signature") continue;
      const step = (w.config?.assignedStep as number | undefined) ?? 0;
      if (step <= 0) continue;
      const arr = map.get(step) ?? [];
      arr.push(w.label);
      map.set(step, arr);
    }
    return map;
  }, [widgets]);

  const maxSignatureStep = useMemo(() => {
    let max = 0;
    for (const step of signaturesByStep.keys()) max = Math.max(max, step);
    return max;
  }, [signaturesByStep]);

  // Si el formulario tiene firmas hasta el paso N, garantizamos que el
  // builder de tareas muestre N cajas de destinatarios.
  useEffect(() => {
    if (maxSignatureStep > 0) stepsCtl.ensureStepCount(maxSignatureStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSignatureStep]);

  useEffect(() => {
    getUsersApi().then((r) => {
      if (r.data) {
        setAllUsers(
          r.data.map((u) => ({ id: u.id, email: u.email, name: u.name })),
        );
      }
    });
    getGroupsApi().then((r) => {
      if (r.data) setGroups(r.data);
    });
  }, []);

  const collectFieldValue = (fd: FormData, name: string): string => {
    const vals = fd.getAll(name);
    if (vals.length === 0) return "";
    return vals.map(String).filter((v) => v !== "").join(",");
  };

  const handlePrefillChange = () => {
    if (!prefillFormRef.current) return;
    const fd = new FormData(prefillFormRef.current);
    const values: Record<string, string> = {};
    widgets.forEach((w) => {
      const val = collectFieldValue(fd, w.id);
      if (val) values[w.id] = val;
    });
    setPrefilledData(values);
  };

  // Un widget (ej. search) puede rellenar OTROS campos tras una selección
  // (fieldMappings) y también su propio valor. Igual que FormPage: seteamos el
  // input destino con el setter nativo (compatible con React 19) y disparamos
  // 'input' para que el form se entere y handlePrefillChange lo capture.
  const handlePrefillWidgetValues = (vals: Record<string, string>) => {
    const form = prefillFormRef.current;
    if (!form) return;
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    const nativeSelectSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;

    const subformFills = new Map<string, Record<string, string>>();

    for (const [name, value] of Object.entries(vals)) {
      if (name.includes(":")) {
        const [subformId, fieldId] = name.split(":", 2);
        if (!subformId || !fieldId) continue;
        const bag = subformFills.get(subformId) ?? {};
        bag[fieldId] = value;
        subformFills.set(subformId, bag);
        continue;
      }
      const el = form.elements.namedItem(name) as HTMLElement | RadioNodeList | null;
      if (!el || el instanceof RadioNodeList) continue;
      if (el instanceof HTMLInputElement && nativeInputSetter) {
        nativeInputSetter.call(el, value);
      } else if (el instanceof HTMLTextAreaElement && nativeTextareaSetter) {
        nativeTextareaSetter.call(el, value);
      } else if (el instanceof HTMLSelectElement && nativeSelectSetter) {
        nativeSelectSetter.call(el, value);
      } else {
        continue;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    for (const [subformId, fill] of subformFills) {
      window.dispatchEvent(
        new CustomEvent("subform:fill", { detail: { subformId, values: fill } }),
      );
    }

    handlePrefillChange();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setSaving(true);
    setError("");

    // Capturar prefill actual (mismo patrón que antes)
    const finalPrefilled = { ...prefilledData };
    if (prefillFormRef.current) {
      const fd = new FormData(prefillFormRef.current);
      widgets.forEach((w) => {
        const val = collectFieldValue(fd, w.id);
        if (val) finalPrefilled[w.id] = val;
      });
    }
    // No prellenar campos ocultos por reglas (coherente con la vista del tab).
    prefillHiddenIds.forEach((id) => delete finalPrefilled[id]);

    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          formId,
          folderId,
          formName,
          widgets,
          rules,
          emailTemplate:
            folders
              .find((f) => f.id === folderId)
              ?.forms.find((fm) => fm.id === formId)?.emailTemplate ?? null,
          title,
          description,
          prefilledData: finalPrefilled,
          steps: [], // <-- vacío: se agregan luego con /send
          generateShareLink: shareEnabled,
          oneShotLink: shareEnabled ? oneShotLink : false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear la tarea");
      }
      const data = await res.json();
      const taskId = data._id || data.id;
      if (!taskId) throw new Error("Respuesta sin id de tarea");

      setCreatedTaskId(taskId);
      setTaskCreated(true);
      if (data.shareLinkUrl) setShareLinkUrl(data.shareLinkUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShareLink = async (nextEnabled: boolean) => {
    if (!createdTaskId) {
      // Pre-create: solo update local del shareEnabled state.
      setShareEnabled(nextEnabled);
      return;
    }
    if (!nextEnabled && shareLinkUrl) {
      // Confirm inline antes de destildar (link viejo dejará de funcionar).
      if (!window.confirm('El enlace actual dejará de funcionar. ¿Continuar?')) {
        setShareCheckboxKey((k) => k + 1);
        return;
      }
    }
    setLinkBusy(true);
    const res = await toggleTaskShareLinkApi(createdTaskId, nextEnabled);
    setLinkBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'No se pudo actualizar el enlace');
      setShareCheckboxKey((k) => k + 1);
      return;
    }
    setShareEnabled(nextEnabled);
    setShareLinkUrl(res.data.shareLinkUrl);
  };

  const handleSend = async () => {
    if (!createdTaskId) return;
    const validSteps = stepsCtl.steps.filter((s) =>
      s.inputEmail.trim().includes("@"),
    );
    if (validSteps.length === 0) {
      setError("Agrega al menos un destinatario con email válido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/tasks/${createdTaskId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          steps: validSteps.map((s) => ({
            recipientEmail: s.inputEmail.trim(),
            recipientName: s.inputName.trim() || s.inputEmail,
          })),
        }),
      });
      if (!res.ok) {
        // 409 = la tarea ya fue enviada (por ejemplo, doble click o un
        // envío previo que sí llegó al backend pero cuya respuesta se
        // perdió). No es un error accionable para el usuario: la tarea
        // ya está en curso, así que simplemente cerramos y refrescamos.
        if (res.status === 409) {
          onCreated();
          onClose();
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al enviar la tarea");
      }
      onCreated();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => setTab(tab === "steps" ? "prefill" : "info");
  const goNext = () => setTab(tab === "info" ? "prefill" : "steps");

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      <div className="animate-modal-in flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.6)]">
                <Icon name="send" size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-[20px] font-extrabold tracking-tight text-slate-900">
                  Crear tarea
                </div>
                <div className="truncate text-[12.5px] text-gray-400">{formName}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="x" size={17} />
            </button>
          </div>
          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 border-none bg-transparent px-4 py-3 font-sans text-[13px] transition-all"
                  style={{
                    borderBottomColor: active ? "#00c2a8" : "transparent",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#0891b2" : "#94a3b8",
                  }}
                >
                  <Icon name={t.icon} size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div style={{ display: tab === "info" ? "block" : "none" }}>
            <fieldset disabled={taskCreated} className={taskCreated ? "opacity-70" : ""}>
              <InfoTab
                title={title}
                description={description}
                onChangeTitle={setTitle}
                onChangeDescription={setDescription}
              />
            </fieldset>
          </div>
          <div style={{ display: tab === "prefill" ? "block" : "none" }}>
            <fieldset disabled={taskCreated} className={taskCreated ? "opacity-70" : ""}>
              <PrefillTab
                ref={prefillFormRef}
                widgets={widgets}
                hiddenWidgetIds={prefillHiddenIds}
                onChange={handlePrefillChange}
                onWidgetValues={handlePrefillWidgetValues}
              />
            </fieldset>
          </div>
          <div style={{ display: tab === "steps" ? "block" : "none" }}>
            <StepsTab
              steps={stepsCtl.steps}
              allUsers={allUsers}
              groups={groups}
              signaturesByStep={signaturesByStep}
              showDropdown={stepsCtl.showDropdown}
              onAddStep={stepsCtl.addStep}
              onRemoveStep={stepsCtl.removeStep}
              onMoveStep={stepsCtl.moveStep}
              onChangeStepEmail={stepsCtl.setStepExternal}
              onSetShowDropdown={stepsCtl.setShowDropdownFor}
              onSelectStepUser={stepsCtl.setStepRecipient}
              onAddGroupMembers={stepsCtl.handleAddGroupMembers}
              shareEnabled={shareEnabled}
              onShareEnabledChange={handleToggleShareLink}
              disabled={!taskCreated}
              shareCheckboxDisabled={linkBusy}
              shareCheckboxKey={shareCheckboxKey}
              shareLinkUrl={shareLinkUrl}
              oneShotLink={oneShotLink}
              onOneShotLinkChange={setOneShotLink}
            />
          </div>
        </div>

        {error && (
          <div className="mx-6 flex items-center gap-2 rounded-xl border-[1.5px] border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600">
            <Icon name="alert" size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="flex gap-2">
            {tab !== "info" && (
              <button
                onClick={goPrev}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
              >
                <Icon name="chevronRight" size={14} className="rotate-180" /> Anterior
              </button>
            )}
            {tab !== "steps" && (
              <button
                onClick={goNext}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-[#00c2a8]/30 bg-[#00c2a8]/5 px-4 py-2 text-[13px] font-semibold text-[#0891b2] transition-all duration-150 hover:-translate-y-px hover:bg-[#00c2a8]/10"
              >
                Siguiente <Icon name="chevronRight" size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-5 py-2 text-[13px] font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
            >
              Cancelar
            </button>
            {tab === "steps" && (
              <>
                <button
                  onClick={handleCreate}
                  disabled={saving || taskCreated || !title.trim()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                  style={{
                    background: taskCreated
                      ? "linear-gradient(135deg,#10b981,#059669)"
                      : saving || !title.trim()
                      ? "#94a3b8"
                      : "linear-gradient(135deg,#00c2a8,#0891b2)",
                  }}
                >
                  {taskCreated ? (
                    <><Icon name="checkCircle" size={15} /> Tarea creada</>
                  ) : saving ? (
                    "Creando..."
                  ) : (
                    "Crear tarea"
                  )}
                </button>
                <button
                  onClick={handleSend}
                  disabled={saving || !taskCreated}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                  style={{
                    background: !taskCreated || saving
                      ? "#94a3b8"
                      : "linear-gradient(135deg,#00c2a8,#0891b2)",
                  }}
                >
                  <Icon name="send" size={14} /> {saving ? "Enviando..." : "Enviar tarea"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
