import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { useFolderStore } from "../store/useFolderStore";
import { requestReportByEmailApi } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import type { FormItem } from "../types/folder.types";
import type { WidgetInstance } from "../types/widget.types";
import RecordsTable from "../components/reports/RecordsTable";
import TaskDownloadsPanel from "../components/reports/TaskDownloadsPanel";
import ExcelFieldSelector from "../components/reports/ExcelFieldSelector";
import Icon from "../components/common/Icon";
import SelectMenu, { type SelectOption } from "../components/common/SelectMenu";

type Tab = "excel" | "records" | "downloads-per-task";

export default function ReportsPage() {
  const { projects, selectedProjectId, selectProject, loadProjects } =
    useProjectStore();
  const { folders, loadFolders } = useFolderStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [tab, setTab] = useState<Tab>("excel");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFormId, setSelectedFormId] = useState("");

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (selectedProjectId) loadFolders(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const projectFolders = useMemo(
    () => folders.filter((f) => f.projectId === selectedProjectId),
    [folders, selectedProjectId],
  );
  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );
  const selectedForm: FormItem | null = useMemo(
    () => selectedFolder?.forms.find((f) => f.id === selectedFormId) ?? null,
    [selectedFolder, selectedFormId],
  );

  const handleProjectChange = (id: string) => {
    selectProject(id);
    setSelectedFolderId("");
    setSelectedFormId("");
  };
  const handleFolderChange = (id: string) => {
    setSelectedFolderId(id);
    setSelectedFormId("");
  };

  const projectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "— Seleccionar proyecto —" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects],
  );
  const folderOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "— Seleccionar carpeta —" },
      ...projectFolders.map((f) => ({ value: f.id, label: f.name })),
    ],
    [projectFolders],
  );
  const formOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "— Seleccionar formulario —" },
      ...(selectedFolder?.forms ?? []).map((f) => ({ value: f.id, label: f.name })),
    ],
    [selectedFolder],
  );

  const TABS = [
    { id: "excel" as Tab, icon: "table", label: "Excel por correo" },
    { id: "records" as Tab, icon: "fileText", label: "Registros y PDFs" },
    { id: "downloads-per-task" as Tab, icon: "download", label: "Descargas por tarea" },
  ];

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
          {/* Cabecera */}
          <div className="animate-fade-up mb-5 flex items-center gap-3 sm:gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.55)] sm:h-12 sm:w-12">
              <Icon name="chart" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900 sm:text-[24px]">
                Reportes
              </h1>
              <p className="mt-0.5 text-[12.5px] text-gray-500 sm:text-[13px]">
                Exporta registros a Excel y descarga los PDFs de tus formularios.
              </p>
            </div>
          </div>

          {/* Pestañas */}
          <div className="animate-fade-up mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_6px_20px_-16px_rgba(15,40,80,0.3)] [animation-delay:60ms]">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-4 py-2.5 text-[13px] font-semibold transition-all"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(0,194,168,0.16) 0%, rgba(8,145,178,0.12) 100%)"
                      : "transparent",
                    color: active ? "#0891b2" : "#64748b",
                    boxShadow: active ? "inset 0 0 0 1px rgba(0,194,168,0.22)" : "none",
                  }}
                >
                  <Icon name={t.icon} size={16} /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Selectores comunes */}
          <div className="animate-fade-up mb-4 grid gap-3 rounded-[20px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)] backdrop-blur-sm sm:grid-cols-3 [animation-delay:120ms]">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon name="building" size={12} className="text-[#00c2a8]" /> Proyecto
              </label>
              <SelectMenu
                value={selectedProjectId ?? ""}
                onChange={handleProjectChange}
                options={projectOptions}
                leftIcon="building"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon name="folder" size={12} className="text-[#00c2a8]" /> Carpeta
              </label>
              <SelectMenu
                value={selectedFolderId}
                onChange={handleFolderChange}
                options={folderOptions}
                leftIcon="folder"
                disabled={!selectedProjectId}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Icon name="clipboard" size={12} className="text-[#00c2a8]" /> Formulario
              </label>
              <SelectMenu
                value={selectedFormId}
                onChange={setSelectedFormId}
                options={formOptions}
                leftIcon="clipboard"
                disabled={!selectedFolderId}
              />
            </div>
          </div>

          {tab === "excel" && (
            <ExcelReportPanel selectedForm={selectedForm} currentUser={currentUser} />
          )}

          {tab === "records" && selectedForm && (
            <RecordsTable formId={selectedForm.id} formName={selectedForm.name} />
          )}
          {tab === "records" && !selectedForm && <SelectPrompt />}

          {tab === "downloads-per-task" && selectedForm && (
            <TaskDownloadsPanel
              formId={selectedForm.id}
              formName={selectedForm.name}
              widgets={(selectedForm.widgets ?? []) as WidgetInstance[]}
            />
          )}
          {tab === "downloads-per-task" && !selectedForm && <SelectPrompt />}
        </div>
      </div>
    </div>
  );
}

/** Estado vacío cuando aún no se ha elegido un formulario. */
function SelectPrompt() {
  return (
    <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name="fileText" size={26} />
      </div>
      <p className="text-[15px] font-bold text-slate-700">Elige un formulario</p>
      <p className="mt-1 text-[13px] text-gray-400">
        Selecciona proyecto, carpeta y formulario para ver sus registros.
      </p>
    </div>
  );
}

// ── Panel Excel (contenido previo de ReportsPage) ───────────────────────────
type Field = { id: string; label: string; type: string };

function ExcelReportPanel({
  selectedForm,
  currentUser,
}: {
  selectedForm: FormItem | null;
  currentUser: { email?: string } | null;
}) {
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    new Set(),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; message: string } | null
  >(null);

  const fields: Field[] = useMemo(() => {
    if (!selectedForm) return [];
    const widgets = (selectedForm.widgets ?? []) as WidgetInstance[];
    return widgets
      .filter((w) => !!w.label?.trim())
      .map((w) => ({ id: w.id, label: w.label, type: w.type }));
  }, [selectedForm]);

  useEffect(() => {
    setSelectedFieldIds(new Set(fields.map((f) => f.id)));
    setFeedback(null);
  }, [selectedForm?.id, fields]);

  const handleSendByEmail = async () => {
    if (!selectedForm || selectedFieldIds.size === 0) {
      setFeedback({ kind: "err", message: "Selecciona al menos un campo." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const res = await requestReportByEmailApi(
      selectedForm.id,
      Array.from(selectedFieldIds),
    );
    setBusy(false);
    if (res.error || !res.data) {
      setFeedback({
        kind: "err",
        message: res.error ?? "No se pudo generar el reporte.",
      });
      return;
    }
    setFeedback({ kind: "ok", message: res.data.message });
  };

  if (!selectedForm) {
    return (
      <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="table" size={26} />
        </div>
        <p className="text-[15px] font-bold text-slate-700">Elige un formulario</p>
        <p className="mt-1 text-[13px] text-gray-400">
          Selecciona un formulario para armar el reporte de Excel.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.25)]">
      {/* Aviso de envío */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3.5 py-3 text-[12.5px] text-slate-700">
        <Icon name="mail" size={16} className="mt-px flex-shrink-0 text-[#0891b2]" />
        <span>
          Te enviaremos un enlace de descarga a{" "}
          <strong className="text-slate-800">{currentUser?.email ?? "tu correo"}</strong>. El
          enlace dura 2 min y requiere 2FA.
        </span>
      </div>

      <ExcelFieldSelector
        widgets={(selectedForm.widgets ?? []) as WidgetInstance[]}
        selectedFieldIds={selectedFieldIds}
        onChange={setSelectedFieldIds}
      />

      {feedback && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
            feedback.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <Icon
            name={feedback.kind === "ok" ? "checkCircle" : "alert"}
            size={15}
            className="flex-shrink-0"
          />
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSendByEmail}
          disabled={busy || selectedFieldIds.size === 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
        >
          <Icon name="send" size={15} />
          {busy ? "Enviando…" : "Solicitar reporte"}
        </button>
      </div>
    </div>
  );
}
