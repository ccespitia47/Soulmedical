import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { useFolderStore } from "../store/useFolderStore";
import { requestReportByEmailApi } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import type { FormItem } from "../types/folder.types";
import type { WidgetInstance } from "../types/widget.types";
import RecordsTable from "../components/reports/RecordsTable";

type Field = { id: string; label: string; type: string };

type Tab = "excel" | "records";

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

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-6">
          <h1 className="m-0 text-[22px] font-bold text-gray-900">Reportes</h1>

          <div className="mt-3 flex border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setTab("excel")}
              className={`cursor-pointer border-none bg-transparent px-5 py-3 text-[13px] font-semibold ${
                tab === "excel"
                  ? "border-b-[2.5px] border-[#00c2a8] text-[#0f766e]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📊 Excel por correo
            </button>
            <button
              type="button"
              onClick={() => setTab("records")}
              className={`cursor-pointer border-none bg-transparent px-5 py-3 text-[13px] font-semibold ${
                tab === "records"
                  ? "border-b-[2.5px] border-[#00c2a8] text-[#0f766e]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📄 Registros y PDFs
            </button>
          </div>

          {/* Selectores comunes */}
          <div className="my-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Proyecto
              </label>
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px]"
              >
                <option value="">— Seleccionar proyecto —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Carpeta
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => handleFolderChange(e.target.value)}
                disabled={!selectedProjectId}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">— Seleccionar carpeta —</option>
                {projectFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.icon} {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Formulario
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                disabled={!selectedFolderId}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">— Seleccionar formulario —</option>
                {(selectedFolder?.forms ?? []).map((form) => (
                  <option key={form.id} value={form.id}>
                    📋 {form.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab === "excel" && (
            <ExcelReportPanel selectedForm={selectedForm} currentUser={currentUser} />
          )}

          {tab === "records" && selectedForm && (
            <RecordsTable formId={selectedForm.id} formName={selectedForm.name} />
          )}
          {tab === "records" && !selectedForm && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
              Selecciona proyecto, carpeta y formulario para ver sus registros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel Excel (contenido previo de ReportsPage) ───────────────────────────
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

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
        Selecciona un formulario para armar el reporte.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-[12px] text-slate-600">
        Te enviaremos un enlace de descarga a{" "}
        <strong>{currentUser?.email ?? "tu correo"}</strong>. El enlace dura 2 min y requiere 2FA.
      </div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] text-slate-500">
          {selectedFieldIds.size} de {fields.length} campo(s) seleccionado(s)
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFieldIds(new Set(fields.map((f) => f.id)))}
            className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setSelectedFieldIds(new Set())}
            className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600"
          >
            Ninguno
          </button>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <label
            key={f.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 hover:bg-slate-100"
          >
            <input
              type="checkbox"
              checked={selectedFieldIds.has(f.id)}
              onChange={() => toggleField(f.id)}
              className="h-4 w-4 cursor-pointer accent-[#00c2a8]"
            />
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-gray-900">
                {f.label}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                {f.type}
              </div>
            </div>
          </label>
        ))}
      </div>
      {feedback && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${
            feedback.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.kind === "ok" ? "✓ " : "⚠️ "}
          {feedback.message}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSendByEmail}
          disabled={busy || selectedFieldIds.size === 0}
          className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,194,168,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Solicitar reporte →"}
        </button>
      </div>
    </div>
  );
}
