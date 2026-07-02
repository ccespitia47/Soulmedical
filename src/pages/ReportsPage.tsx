import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { useFolderStore } from "../store/useFolderStore";
import { requestReportByEmailApi } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import type { FormItem } from "../types/folder.types";
import type { WidgetInstance } from "../types/widget.types";

type Field = {
  id: string;
  label: string;
  type: string;
};

export default function ReportsPage() {
  const { projects, selectedProjectId, selectProject, loadProjects } =
    useProjectStore();
  const { folders, loadFolders } = useFolderStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");

  // Campos seleccionados por widget.id. Al cambiar de formulario se
  // re-inicializa a "todos marcados".
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    new Set(),
  );

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; message: string } | null
  >(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadFolders(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // ── Derivados ──────────────────────────────────────────────────────────────
  const projectFolders = useMemo(
    () => folders.filter((f) => f.projectId === selectedProjectId),
    [folders, selectedProjectId],
  );

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const selectedForm: FormItem | null = useMemo(() => {
    if (!selectedFolder) return null;
    return selectedFolder.forms.find((f) => f.id === selectedFormId) ?? null;
  }, [selectedFolder, selectedFormId]);

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
  }, [selectedFormId, fields]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (mark: boolean) => {
    setSelectedFieldIds(mark ? new Set(fields.map((f) => f.id)) : new Set());
  };

  const handleProjectChange = (id: string) => {
    selectProject(id);
    setSelectedFolderId("");
    setSelectedFormId("");
  };

  const handleFolderChange = (id: string) => {
    setSelectedFolderId(id);
    setSelectedFormId("");
  };

  const handleSendByEmail = async () => {
    if (!selectedForm) return;
    if (selectedFieldIds.size === 0) {
      setFeedback({
        kind: "err",
        message: "Selecciona al menos un campo para el reporte.",
      });
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

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-6 py-8">
          <div className="mb-6">
            <h1 className="m-0 text-[22px] font-bold text-gray-900">
              📊 Reporte de envíos
            </h1>
            <p className="mt-1 text-[13px] text-gray-500">
              Elige un formulario, marca los campos que quieres incluir
              en el reporte. Se enviará a tu correo{currentUser?.email
                ? ` (${currentUser.email})`
                : ""}{" "}
              como un archivo ZIP protegido.
            </p>
          </div>

          {/* Aviso de seguridad */}
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3.5">
            <span className="text-lg">🔐</span>
            <div className="text-[12px] leading-relaxed text-blue-900">
              <div className="font-semibold">
                Descarga por enlace de un solo uso
              </div>
              <div className="mt-0.5 text-blue-800">
                Te enviamos un enlace a tu correo que dura <strong>2 minutos</strong>.
                Al clicearlo pediremos tu <strong>código 2FA</strong> y descargarás un archivo Excel cifrado. Para abrirlo, Excel te pedirá tu <strong>número de documento</strong>.
              </div>
            </div>
          </div>

          {/* Selectores en cascada */}
          <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Proyecto
              </label>
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] text-gray-900 outline-none"
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
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] text-gray-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-gray-400"
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
                className="w-full cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-2 text-[13px] text-gray-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-gray-400"
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

          {/* Panel de campos */}
          {!selectedForm ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
              <span className="mb-3 block text-5xl">📋</span>
              <p className="text-[15px] font-semibold">
                Selecciona un formulario
              </p>
              <p className="text-[13px]">
                Elige proyecto, carpeta y formulario en los selectores de
                arriba.
              </p>
            </div>
          ) : fields.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-gray-400">
              <span className="mb-3 block text-5xl">🫥</span>
              <p className="text-[15px] font-semibold">
                Este formulario no tiene campos
              </p>
              <p className="text-[13px]">
                Agrega widgets desde el builder para poder solicitar reportes.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-bold text-gray-900">
                    Campos a incluir en el reporte
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-gray-500">
                    {selectedFieldIds.size} de {fields.length} campo(s)
                    seleccionado(s)
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 hover:bg-slate-50"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="cursor-pointer rounded-md border-[1.5px] border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 hover:bg-slate-50"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2">
                {fields.map((f) => {
                  const checked = selectedFieldIds.has(f.id);
                  return (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
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
                  );
                })}
              </div>

              {feedback && (
                <div
                  className="mt-3 rounded-md border px-3 py-2 text-[12px]"
                  style={{
                    borderColor: feedback.kind === "ok" ? "#a7f3d0" : "#fecaca",
                    background:
                      feedback.kind === "ok" ? "#ecfdf5" : "#fef2f2",
                    color: feedback.kind === "ok" ? "#065f46" : "#b91c1c",
                  }}
                >
                  {feedback.kind === "ok" ? "✓" : "⚠️"} {feedback.message}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSendByEmail}
                  disabled={busy || selectedFieldIds.size === 0}
                  className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,194,168,0.35)] transition disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {busy ? "Enviando..." : "Solicitar reporte →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
