import { useState, useEffect } from "react";
import type { WidgetPropertiesProps } from "../../../types/widget.types";
import type { SearchWidgetConfig, SearchSourceType, FieldMapping } from "./search.types";
import { useFolderStore } from "../../../store/useFolderStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { fetchSheetsHeaders, parseSheetsUrl } from "./sources/googleSheets";


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
  // Headers auto-detectados del Google Sheet cuando el user pega la URL.
  const [sheetsHeaders, setSheetsHeaders] = useState<string[]>([]);
  const [sheetsDetecting, setSheetsDetecting] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  const setConfig = (changes: Partial<SearchWidgetConfig>) =>
    updateWidget(widget.id, { config: { ...config, ...changes } });

  // Auto-detección de headers al pegar URL de Google Sheets. Debounce 600ms.
  useEffect(() => {
    if (config.sourceType !== "google_sheets") return;
    const url = config.sheetsUrl?.trim() ?? "";
    if (!url) { setSheetsHeaders([]); setSheetsError(null); return; }
    const parsed = parseSheetsUrl(url);
    if (!parsed) { setSheetsHeaders([]); setSheetsError("URL no reconocida"); return; }
    setSheetsDetecting(true);
    setSheetsError(null);
    const t = setTimeout(async () => {
      try {
        const headers = await fetchSheetsHeaders(url);
        if (headers.length === 0) {
          setSheetsError(
            "No se pudieron leer las columnas. Comparte el Sheet como 'Cualquiera con el enlace' (Lector) o cambia el acceso general a público.",
          );
          setSheetsHeaders([]);
        } else {
          setSheetsHeaders(headers);
          // Guardar el gid detectado en la config para el fetch real
          if (parsed.gid && parsed.gid !== config.sheetsGid) {
            setConfig({ sheetsGid: parsed.gid });
          }
        }
      } catch (err) {
        // Los fetch al gviz/tq de un Sheet privado se convierten en redirect
        // a accounts.google.com/ServiceLogin y el navegador lo bloquea por
        // CORS. Es indistinguible de un error de red, pero es la causa
        // muchísimo más común.
        console.error("[SearchWidget] Error detectando Google Sheet:", err);
        setSheetsError(
          "No se pudo acceder al Sheet. Verifica que esté compartido como 'Cualquiera con el enlace' (Lector).",
        );
        setSheetsHeaders([]);
      } finally {
        setSheetsDetecting(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sheetsUrl, config.sourceType]);

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

  // Widgets del formulario actual (para mappings destino).
  // Expande los subforms: por cada subform aparece un item por campo interno
  // con value "subformId:fieldId" y label "Subform › Field".
  type TargetOpt = { value: string; label: string };
  const currentWidgets = allWidgets ?? [];
  const targetWidgetOptions: TargetOpt[] = [];
  for (const w of currentWidgets) {
    if (w.id === widget.id) continue;
    if (w.type === "subform") {
      const fields = (w.config?.fields as { id: string; label: string }[] | undefined) ?? [];
      for (const f of fields) {
        targetWidgetOptions.push({
          value: `${w.id}:${f.id}`,
          label: `${w.label} › ${f.label}`,
        });
      }
    } else {
      targetWidgetOptions.push({ value: w.id, label: w.label });
    }
  }

  // Opciones conocidas de "campos fuente" según el tipo de source:
  //   - form_submissions + sourceFormId → widgets del form fuente
  //   - group → name/email (fijos)
  //   - google_sheets/excel_web/sql → desconocidos hasta el fetch → null (usa input libre)
  type FieldOpt = { value: string; label: string };
  let sourceFieldOptions: FieldOpt[] | null = null;
  if (config.sourceType === "form_submissions" && sourceWidgets.length > 0) {
    sourceFieldOptions = sourceWidgets.map((w) => ({ value: w.id, label: w.label }));
  } else if (config.sourceType === "group") {
    sourceFieldOptions = [
      { value: "name", label: "Nombre" },
      { value: "email", label: "Email" },
    ];
  } else if (config.sourceType === "google_sheets" && sheetsHeaders.length > 0) {
    sourceFieldOptions = sheetsHeaders.map((h) => ({ value: h, label: h }));
  }
  const findFieldLabel = (key: string): string =>
    sourceFieldOptions?.find((o) => o.value === key)?.label ?? key;

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
          <p className="mt-1 text-[11px] text-gray-400">
            Pega la URL — se detectarán las columnas automáticamente. La hoja debe
            ser pública ("Cualquiera con el enlace"). Si compartes el link con
            <code className="mx-1">#gid=…</code> se usa esa hoja específica.
          </p>

          {sheetsDetecting && (
            <div className="mt-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] text-blue-700">
              ⏳ Detectando columnas…
            </div>
          )}
          {sheetsError && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
              ⚠️ {sheetsError}
            </div>
          )}

          {sheetsHeaders.length > 0 && (
            <>
              <div className="mt-3 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11.5px] text-emerald-700">
                ✓ {sheetsHeaders.length} columna(s) detectada(s)
              </div>
              <label className={`${LABEL} mt-3`}>Columna donde buscar</label>
              <select className={INPUT} value={config.sheetsSearchCol ?? ""}
                onChange={(e) => setConfig({ sheetsSearchCol: e.target.value })}>
                <option value="">-- Selecciona una columna --</option>
                {sheetsHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </>
          )}
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
        {(config.displayColumns ?? []).map((col, i) => {
          const resolvedKey = findFieldLabel(col.key);
          const showBoth = resolvedKey !== col.label;
          return (
            <div key={i} className="mb-1.5 flex items-center gap-2">
              <span className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]">
                <strong>{resolvedKey}</strong>
                {showBoth && <span className="text-gray-400"> → {col.label}</span>}
              </span>
              <button onClick={() => removeDisplayColumn(i)}
                className="cursor-pointer rounded border-none bg-red-50 px-2 py-1 text-xs text-red-500">✕</button>
            </div>
          );
        })}
        <div className="flex gap-2 mt-2">
          {sourceFieldOptions ? (
            // Dropdown: el label se toma automáticamente del campo elegido, no
            // hace falta el input de etiqueta extra (se duplicaría).
            <select
              className={`${INPUT} flex-1`}
              value={newColKey}
              onChange={(e) => {
                setNewColKey(e.target.value);
                setNewColLabel(findFieldLabel(e.target.value));
              }}
            >
              <option value="">-- Selecciona un campo --</option>
              {sourceFieldOptions
                .filter((o) => !(config.displayColumns ?? []).some((c) => c.key === o.value))
                .map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
          ) : (
            // Sin opciones conocidas (SQL/Excel/Google Sheets): el user
            // escribe el key técnico y una etiqueta legible por separado.
            <>
              <input className={`${INPUT} flex-1`} placeholder="Key (campo)" value={newColKey}
                onChange={(e) => setNewColKey(e.target.value)} />
              <input className={`${INPUT} flex-1`} placeholder="Etiqueta" value={newColLabel}
                onChange={(e) => setNewColLabel(e.target.value)} />
            </>
          )}
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
            {sourceFieldOptions ? (
              <select
                className={`${INPUT} flex-1`}
                value={m.sourceField}
                onChange={(e) => updateMapping(i, { sourceField: e.target.value })}
              >
                <option value="">Campo fuente</option>
                {sourceFieldOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input className={`${INPUT} flex-1`} placeholder="Campo fuente (key)"
                value={m.sourceField}
                onChange={(e) => updateMapping(i, { sourceField: e.target.value })} />
            )}
            <span className="text-gray-400">→</span>
            <select className={`${INPUT} flex-1`} value={m.targetWidgetId}
              onChange={(e) => updateMapping(i, { targetWidgetId: e.target.value })}>
              <option value="">Campo destino</option>
              {targetWidgetOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
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