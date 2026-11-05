import { useEffect } from "react";
import type { WidgetPropertiesProps } from "../../../types/widget.types";
import { useFolderStore } from "../../../store/useFolderStore";
import { useProjectStore } from "../../../store/useProjectStore";

const INPUT = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 13.5,
  fontFamily: "inherit",
  backgroundColor: "#fafafa",
  color: "#111827",
  boxSizing: "border-box" as const,
  outline: "none",
};
const LABEL = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600 as const,
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  marginBottom: 5,
};
const HINT = { fontSize: 11.5, color: "#9ca3af", marginTop: 4 };

type SubField = { id: string; label: string };
type FormEntry = { id: string; name: string; widgets?: SchemaWidget[] };
type SchemaWidget = {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
};

/**
 * Properties del widget. Tres decisiones del admin:
 *   1. ¿Qué formulario es la Planeación? (dropdown de forms del proyecto).
 *   2. Dentro de ese form, ¿qué subformulario contiene las actividades?
 *      (cada fila del subform = una actividad planeada).
 *   3. ¿Qué campos de cada actividad mostrar en el render al cumplir?
 *      El primero marcado se usa como título.
 */
export default function PendingActivityProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const cfg = widget.config;
  const set = (changes: Record<string, unknown>) =>
    updateWidget(widget.id, { config: { ...cfg, ...changes } });

  const { folders, loadFormDetails } = useFolderStore();
  const { selectedProjectId } = useProjectStore();
  const foldersInProject = folders.filter(
    (f) => !selectedProjectId || f.projectId === selectedProjectId,
  );
  const forms = foldersInProject.flatMap(
    (f) => (f.forms ?? []) as FormEntry[],
  );

  const planningForm = forms.find((f) => f.id === cfg.planningFormId);
  const subforms = (planningForm?.widgets ?? []).filter(
    (w) => w.type === "subform",
  );

  // Los forms "hermanos" del proyecto están en modo resumen (widgets=[])
  // hasta que alguien los abre en el Builder — por eso el selector mostraba
  // "no tiene subformulario" aunque sí los tiene. Hidratamos el form
  // seleccionado on-demand. `loadFormDetails` es idempotente (si ya está
  // hidratado, re-sincroniza; no hace daño).
  const planningFormId = cfg.planningFormId as string | undefined;
  const needsHydration =
    !!planningFormId &&
    !!planningForm &&
    (planningForm.widgets ?? []).length === 0;
  useEffect(() => {
    if (!needsHydration || !planningFormId) return;
    const folder = foldersInProject.find((f) =>
      (f.forms ?? []).some((frm) => frm.id === planningFormId),
    );
    if (folder) void loadFormDetails(folder.id, planningFormId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningFormId, needsHydration]);
  // Compat: migración on-read del legacy `subformWidgetId: string` →
  // `subformWidgetIds: string[]`. Nunca escribimos el viejo de vuelta.
  const subformWidgetIds: string[] = Array.isArray(cfg.subformWidgetIds)
    ? (cfg.subformWidgetIds as string[])
    : typeof cfg.subformWidgetId === "string" && cfg.subformWidgetId
      ? [cfg.subformWidgetId as string]
      : [];

  const selectedSubforms = subforms.filter((w) =>
    subformWidgetIds.includes(w.id),
  );
  // Union de fields de TODOS los subforms seleccionados (dedup por id).
  // El admin marca qué mostrar; si un field no existe en un subform
  // concreto, el runtime lo renderiza vacío — no rompe cuando los
  // subforms tienen campos distintos.
  const subFields: SubField[] = (() => {
    const seen = new Set<string>();
    const out: SubField[] = [];
    for (const sf of selectedSubforms) {
      for (const f of (sf.config?.fields as SubField[]) ?? []) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          out.push(f);
        }
      }
    }
    return out;
  })();
  const displayFields = (cfg.displayFields as string[]) ?? [];

  const toggleSubform = (id: string) => {
    const next = subformWidgetIds.includes(id)
      ? subformWidgetIds.filter((x) => x !== id)
      : [...subformWidgetIds, id];
    // Al cambiar la selección, limpiamos displayFields que ya no existen
    // en los subforms activos (evita checkboxes huérfanos en el runtime).
    const nextIds = new Set(next);
    const nextSubforms = subforms.filter((w) => nextIds.has(w.id));
    const nextFieldIds = new Set<string>();
    for (const sf of nextSubforms)
      for (const f of (sf.config?.fields as SubField[]) ?? [])
        nextFieldIds.add(f.id);
    const prunedDisplay = displayFields.filter((id) => nextFieldIds.has(id));
    set({
      subformWidgetIds: next,
      displayFields: prunedDisplay,
      // Limpio el legacy para no dejar un string apuntando a un subform
      // quizá desmarcado — evita re-migrarlo en una próxima apertura.
      subformWidgetId: undefined,
    });
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Etiqueta</label>
        <input
          style={INPUT}
          value={widget.label}
          onChange={(e) =>
            updateWidget(widget.id, { label: e.target.value })
          }
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={LABEL}>Formulario de planeación</label>
        <select
          style={INPUT}
          value={(cfg.planningFormId as string) ?? ""}
          onChange={(e) =>
            set({
              planningFormId: e.target.value,
              subformWidgetIds: [],
              subformWidgetId: undefined,
              displayFields: [],
            })
          }
        >
          <option value="">-- Selecciona --</option>
          {forms
            .filter((f) => f.id !== widget.id)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
        <p style={HINT}>
          El formulario donde cada usuario registra lo que va a hacer.
        </p>
      </div>

      {planningForm && (
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Subformularios de actividades</label>
          {needsHydration ? (
            <p style={HINT}>Cargando campos del formulario…</p>
          ) : subforms.length === 0 ? (
            <p style={{ ...HINT, color: "#ef4444" }}>
              Ese formulario no tiene un subformulario. Agrega uno con las
              actividades.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 7,
                  background: "#f8fafc",
                  padding: 8,
                }}
              >
                {subforms.map((w) => {
                  const active = subformWidgetIds.includes(w.id);
                  return (
                    <label
                      key={w.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "4px 6px",
                        borderRadius: 5,
                        background: active ? "#ecfeff" : "transparent",
                        fontWeight: active ? 600 : 400,
                        color: "#111827",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleSubform(w.id)}
                        style={{ accentColor: "#0891b2" }}
                      />
                      <span style={{ flex: 1 }}>{w.label}</span>
                    </label>
                  );
                })}
              </div>
              <p style={HINT}>
                Podés activar varios — el widget unirá las actividades
                pendientes de todos los subformularios marcados.
              </p>
            </>
          )}
        </div>
      )}

      {subFields.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Datos a mostrar de cada actividad</label>
          {subFields.map((f) => (
            <label
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                marginBottom: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={displayFields.includes(f.id)}
                onChange={(e) =>
                  set({
                    displayFields: e.target.checked
                      ? [...displayFields, f.id]
                      : displayFields.filter((id) => id !== f.id),
                  })
                }
              />
              {f.label}
            </label>
          ))}
          <p style={HINT}>
            El primero marcado se usa como título de la actividad.
          </p>
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <input
          type="checkbox"
          checked={(cfg.allowMultiple as boolean) ?? true}
          onChange={(e) => set({ allowMultiple: e.target.checked })}
        />
        <span>Permitir cumplir varias actividades en un mismo envío</span>
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) =>
            updateWidget(widget.id, { required: e.target.checked })
          }
        />
        <span>Obligatorio</span>
      </label>
    </>
  );
}
