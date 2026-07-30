import { useState, useEffect } from "react";
import type { WidgetPropertiesProps } from "../../../types/widget.types";
import type { SearchWidgetConfig, SearchSourceType, FieldMapping } from "./search.types";
import { useFolderStore } from "../../../store/useFolderStore";
import { useProjectStore } from "../../../store/useProjectStore";


const INPUT = "box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-neutral-50 px-3 py-2 font-sans text-[13px] text-gray-900 outline-none focus:border-[#00c2a8]";
const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500";
const SECTION = "mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5";

const SOURCE_OPTIONS: { value: SearchSourceType; label: string; icon: string }[] = [
  { value: "form_submissions", label: "Registros de formulario", icon: "📋" },
  { value: "group", label: "Grupos del sistema", icon: "👥" },
  { value: "google_sheets", label: "Google Sheets", icon: "📊" },
  { value: "excel_web", label: "Excel en web", icon: "📗" },
  { value: "sql", label: "Consulta SQL", icon: "🗄️" },
];

export default function SearchProperties({ widget, updateWidget, allWidgets }: WidgetPropertiesProps) {
  const config = widget.config as SearchWidgetConfig;
  const { folders } = useFolderStore();
  const { projects, selectedProjectId } = useProjectStore();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token") ?? "";
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => {});
  }, []);
  const [newColKey, setNewColKey] = useState("");
  const [newColLabel, setNewColLabel] = useState("");

  const setConfig = (changes: Partial<SearchWidgetConfig>) =>
    updateWidget(widget.id, { config: { ...config, ...changes } });

  // Formularios del mismo proyecto
  const projectFolders = folders.filter((f) => f.projectId === selectedProjectId);
  const projectForms = projectFolders.flatMap((f) => f.forms ?? []);

  // Widgets del formulario fuente seleccionado
  const sourceForm = projectForms.find((f) => f.id === config.sourceFormId);
  const sourceWidgets = (sourceForm?.widgets ?? []).filter(
    (w) => !["header", "html_block", "signature", "photo"].includes(w.type),
  );

  const addDisplayColumn = () => {
    if (!newColKey.trim()) return;
    const cols = [...(config.displayColumns ?? []), { key: newColKey.trim(), label: newColLabel.trim() || newColKey.trim() }];
    setConfig({ displayColumns: cols });
    setNewColKey(""); setNewColLabel("");
  };

  const removeDisplayColumn = (i: number) =>
    setConfig({ displayColumns: (config.displayColumns ?? []).filter((_, idx) => idx !== i) });

  const addMapping = () => {
    const m: FieldMapping = { sourceField: "", targetWidgetId: "" };
    setConfig({ fieldMappings: [...(config.fieldMappings ?? []), m] });
  };

  const updateMapping = (i: number, changes: Partial<FieldMapping>) =>
    setConfig({
      fieldMappings: (config.fieldMappings ?? []).map((m, idx) =>
        idx === i ? { ...m, ...changes } : m,
      ),
    });

  const removeMapping = (i: number) =>
    setConfig({ fieldMappings: (config.fieldMappings ?? []).filter((_, idx) => idx !== i) });

  // Widgets del formulario actual (para mappings destino)
  const currentWidgets = allWidgets ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Etiqueta */}
      <div>
        <label className={LABEL}>Etiqueta</label>
        <input className={INPUT} value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })} />
      </div>

      {/* Placeholder */}
      <div>
        <label className={LABEL}>Placeholder</label>
        <input className={INPUT} value={(config.placeholder as string) || ""}
          placeholder="Buscar..."
          onChange={(e) => setConfig({ placeholder: e.target.value })} />
      </div>

      {/* Mínimo de caracteres */}
      <div>
        <label className={LABEL}>Mínimo de caracteres para buscar</label>
        <input type="number" min={1} max={5} className={INPUT}
          value={config.minChars ?? 2}
          onChange={(e) => setConfig({ minChars: parseInt(e.target.value) || 2 })} />
      </div>

      {/* Fuente de datos */}
      <div className={SECTION}>
        <label className={LABEL}>Fuente de datos</label>
        <div className="flex flex-col gap-1.5">
          {SOURCE_OPTIONS.map((s) => (
            <label key={s.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              style={{ borderColor: config.sourceType === s.value ? "#00c2a8" : undefined,
                       background: config.sourceType === s.value ? "#f0fdf4" : undefined }}>
              <input type="radio" checked={config.sourceType === s.value}
                onChange={() => setConfig({ sourceType: s.value })} />
              <span className="text-base">{s.icon}</span>
              <span className="text-[13px] font-semibold text-gray-900">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Config por fuente */}
      {config.sourceType === "form_submissions" && (
        <div className={SECTION}>
          <div className="mb-2 text-xs font-bold uppercase text-gray-500">📋 Formulario fuente</div>
          <label className={LABEL}>Formulario</label>
          <select className={INPUT}
            value={config.sourceFormId ?? ""}
            onChange={(e) => {
              const f = projectForms.find((fm) => fm.id === e.target.value);
              setConfig({ sourceFormId: e.target.value, sourceFormName: f?.name, searchableFields: [], displayField: "" });
            }}>
            <option value="">-- Selecciona un formulario --</option>
            {projectForms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {sourceWidgets.length > 0 && (
            <>
              <label className={`${LABEL} mt-3`}>Campos buscables</label>
              <div className="flex flex-col gap-1.5">
                {sourceWidgets.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox"
                      checked={(config.searchableFields ?? []).includes(w.id)}
                      onChange={(e) => {
                        const fields = config.searchableFields ?? [];
                        setConfig({ searchableFields: e.target.checked
                          ? [...fields, w.id]
                          : fields.filter((id) => id !== w.id) });
                      }} />
                    {w.label}
                  </label>
                ))}
              </div>

              <label className={`${LABEL} mt-3`}>Campo a mostrar en resultado</label>
              <select className={INPUT} value={config.displayField ?? ""}
                onChange={(e) => setConfig({ displayField: e.target.value })}>
                <option value="">-- Selecciona --</option>
                {sourceWidgets.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {config.sourceType === "group" && (
        <div className={SECTION}>
          <div className="mb-2 text-xs font-bold uppercase text-gray-500">👥 Grupo</div>
          <label className={LABEL}>Grupo</label>
          <select className={INPUT} value={config.groupId ?? ""}
            onChange={(e) => {
              const g = groups.find((gr: any) => gr.id === e.target.value);
              setConfig({ groupId: e.target.value, groupName: g?.name });
            }}>
            <option value="">-- Selecciona un grupo --</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {config.sourceType === "google_sheets" && (
        <div className={SECTION}>
          <div className="mb-2 text-xs font-bold uppercase text-gray-500">📊 Google Sheets</div>
          <label className={LABEL}>URL pública del Google Sheet</label>
          <input className={INPUT} value={config.sheetsUrl ?? ""}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            onChange={(e) => setConfig({ sheetsUrl: e.target.value })} />
          <label className={`${LABEL} mt-3`}>Rango (opcional)</label>
          <input className={INPUT} value={config.sheetsRange ?? ""}
            placeholder="Hoja1!A:D"
            onChange={(e) => setConfig({ sheetsRange: e.target.value })} />
          <label className={`${LABEL} mt-3`}>Columna donde buscar</label>
          <input className={INPUT} value={config.sheetsSearchCol ?? ""}
            placeholder="Ej: A o nombre"
            onChange={(e) => setConfig({ sheetsSearchCol: e.target.value })} />
        </div>
      )}

      {config.sourceType === "excel_web" && (
        <div className={SECTION}>
          <div className="mb-2 text-xs font-bold uppercase text-gray-500">📗 Excel en web</div>
          <label className={LABEL}>URL del archivo Excel publicado</label>
          <input className={INPUT} value={config.excelUrl ?? ""}
            placeholder="https://example.com/archivo.xlsx"
            onChange={(e) => setConfig({ excelUrl: e.target.value })} />
          <label className={`${LABEL} mt-3`}>Columna donde buscar</label>
          <input className={INPUT} value={config.excelSearchCol ?? ""}
            placeholder="Ej: A o nombre"
            onChange={(e) => setConfig({ excelSearchCol: e.target.value })} />
        </div>
      )}

      {config.sourceType === "sql" && (
        <div className={SECTION}>
          <div className="mb-2 text-xs font-bold uppercase text-gray-500">🗄️ Consulta SQL</div>
          <label className={LABEL}>URL del endpoint SQL</label>
          <input className={INPUT} value={config.sqlEndpoint ?? ""}
            placeholder="https://tu-backend.com/api/search?q="
            onChange={(e) => setConfig({ sqlEndpoint: e.target.value })} />
          <p className="mt-1.5 text-[11px] text-gray-400">
            El endpoint debe aceptar el parámetro <code>q</code> y devolver un array de objetos JSON.
          </p>
        </div>
      )}

      {/* Columnas a mostrar en el modal */}
      <div className={SECTION}>
        <div className="mb-2 text-xs font-bold uppercase text-gray-500">Columnas a mostrar en resultados</div>
        {(config.displayColumns ?? []).map((col, i) => (
          <div key={i} className="mb-1.5 flex items-center gap-2">
            <span className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]">
              <strong>{col.key}</strong> → {col.label}
            </span>
            <button onClick={() => removeDisplayColumn(i)}
              className="cursor-pointer rounded border-none bg-red-50 px-2 py-1 text-xs text-red-500">✕</button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input className={`${INPUT} flex-1`} placeholder="Key (campo)" value={newColKey}
            onChange={(e) => setNewColKey(e.target.value)} />
          <input className={`${INPUT} flex-1`} placeholder="Etiqueta" value={newColLabel}
            onChange={(e) => setNewColLabel(e.target.value)} />
          <button onClick={addDisplayColumn}
            className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-3 py-1 text-xs font-bold text-white">+</button>
        </div>
      </div>

      {/* Mappings de campos */}
      <div className={SECTION}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray-500">Rellenar campos al seleccionar</span>
          <button onClick={addMapping}
            className="cursor-pointer rounded border-none bg-[#00c2a8] px-2.5 py-1 text-[11px] font-bold text-white">
            + Agregar
          </button>
        </div>
        {(config.fieldMappings ?? []).length === 0 && (
          <p className="text-[11px] text-gray-400">Al seleccionar un resultado, puedes rellenar automáticamente otros campos del formulario.</p>
        )}
        {(config.fieldMappings ?? []).map((m, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input className={`${INPUT} flex-1`} placeholder="Campo fuente (key)"
              value={m.sourceField}
              onChange={(e) => updateMapping(i, { sourceField: e.target.value })} />
            <span className="text-gray-400">→</span>
            <select className={`${INPUT} flex-1`} value={m.targetWidgetId}
              onChange={(e) => updateMapping(i, { targetWidgetId: e.target.value })}>
              <option value="">Campo destino</option>
              {currentWidgets.filter((w) => w.id !== widget.id).map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
            <button onClick={() => removeMapping(i)}
              className="cursor-pointer rounded border-none bg-red-50 px-2 py-1 text-xs text-red-500">✕</button>
          </div>
        ))}
      </div>

      {/* Obligatorio */}
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-900">
        <input type="checkbox" checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })} />
        <span>Campo obligatorio</span>
      </label>
    </div>
  );
}