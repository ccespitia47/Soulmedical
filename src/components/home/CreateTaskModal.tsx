import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useFolderStore } from "../../store/useFolderStore";
import { getGroupsApi, getUsersApi, type GroupData } from "../../services/api";
import type { FormRule, WidgetInstance } from "../../types/widget.types";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "📋 Información" },
  { id: "prefill", label: "✏️ Prediligenciar" },
  { id: "steps", label: "👥 Destinatarios" },
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    const validSteps = stepsCtl.steps.filter((s) =>
      s.inputEmail.trim().includes("@"),
    );
    if (validSteps.length === 0) {
      setError("Agrega al menos un destinatario con email válido");
      return;
    }

    // Capturar datos del prefill form antes de enviar
    const finalPrefilled = { ...prefilledData };
    if (prefillFormRef.current) {
      const fd = new FormData(prefillFormRef.current);
      widgets.forEach((w) => {
        const val = collectFieldValue(fd, w.id);
        if (val) finalPrefilled[w.id] = val;
      });
    }

    setSaving(true);
    setError("");
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
          // Snapshot del emailTemplate al momento de crear la tarea, para
          // que el backend pueda enviar el correo final con el formato del
          // formulario sin tener que consultarlo después.
          emailTemplate:
            folders
              .find((f) => f.id === folderId)
              ?.forms.find((fm) => fm.id === formId)?.emailTemplate ?? null,
          title,
          description,
          prefilledData: finalPrefilled,
          steps: validSteps.map((s) => ({
            recipientEmail: s.inputEmail.trim(),
            recipientName: s.inputName.trim() || s.inputEmail,
          })),
          generateShareLink: shareEnabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear la tarea");
      }
      const responseData = await res.json().catch(() => ({}));
      if (responseData?.shareLinkUrl) {
        // Mostramos el modal secundario con el link. NO llamamos onCreated()
        // aquí porque el parent desmonta este componente al recibirlo, lo que
        // eliminaría el modal antes de que el admin pueda copiar el link.
        // El refresh + cierre se dispara desde el botón "Cerrar" del modal.
        setShareLinkUrl(responseData.shareLinkUrl);
        setSaving(false);
        return;
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-xl">
                📋
              </div>
              <div>
                <div className="text-base font-extrabold text-gray-900">
                  Crear Tarea
                </div>
                <div className="text-xs text-gray-500">{formName}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 cursor-pointer rounded-lg border-none bg-slate-100 text-base text-slate-500"
            >
              ✕
            </button>
          </div>
          <div className="flex border-b border-slate-200">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="-mb-px cursor-pointer border-b-2 border-none bg-transparent px-4 py-2.5 font-sans text-[13px]"
                  style={{
                    borderBottomColor: active ? "#00c2a8" : "transparent",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#00c2a8" : "#6b7280",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div style={{ display: tab === "info" ? "block" : "none" }}>
            <InfoTab
              title={title}
              description={description}
              onChangeTitle={setTitle}
              onChangeDescription={setDescription}
            />
          </div>
          <div style={{ display: tab === "prefill" ? "block" : "none" }}>
            <PrefillTab
              ref={prefillFormRef}
              widgets={widgets}
              onChange={handlePrefillChange}
            />
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
              onShareEnabledChange={setShareEnabled}
            />
          </div>
        </div>

        {error && (
          <div className="mx-6 rounded-lg border-[1.5px] border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4">
          <div className="flex gap-2">
            {tab !== "info" && (
              <button
                onClick={goPrev}
                className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-[18px] py-2 text-[13px] font-semibold text-gray-500"
              >
                ← Anterior
              </button>
            )}
            {tab !== "steps" && (
              <button
                onClick={goNext}
                className="cursor-pointer rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50 px-[18px] py-2 text-[13px] font-semibold text-emerald-700"
              >
                Siguiente →
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500"
            >
              Cancelar
            </button>
            {tab === "steps" && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="cursor-pointer rounded-lg border-none px-6 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed"
                style={{
                  background: saving
                    ? "#94a3b8"
                    : "linear-gradient(135deg,#00c2a8,#0891b2)",
                }}
              >
                {saving ? "Creando..." : "🚀 Crear y enviar tarea"}
              </button>
            )}
          </div>
        </div>
      </div>

      {shareLinkUrl && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-5">
          <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-600 text-xl">
                ✓
              </div>
              <div>
                <div className="text-base font-extrabold text-gray-900">Tarea creada</div>
                <div className="text-xs text-gray-500">Enlace compartible listo</div>
              </div>
            </div>
            <p className="mb-2 text-[13px] text-gray-600">
              Copia este enlace y compártelo por WhatsApp o donde quieras. Cada
              llenado crea un registro nuevo.
            </p>
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLinkUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] text-gray-900"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(shareLinkUrl);
                }}
                className="cursor-pointer rounded-lg border-none bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white"
              >
                📋 Copiar
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  onCreated();
                  setShareLinkUrl(null);
                  onClose();
                }}
                className="cursor-pointer rounded-lg border-none bg-slate-800 px-5 py-2 text-[13px] font-bold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
