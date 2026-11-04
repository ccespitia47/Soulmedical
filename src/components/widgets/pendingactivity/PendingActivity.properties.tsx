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

  const { folders } = useFolderStore();
  const { selectedProjectId } = useProjectStore();
  const forms = folders
    .filter((f) => !selectedProjectId || f.projectId === selectedProjectId)
    .flatMap((f) => (f.forms ?? []) as FormEntry[]);

  const planningForm = forms.find((f) => f.id === cfg.planningFormId);
  const subforms = (planningForm?.widgets ?? []).filter(
    (w) => w.type === "subform",
  );
  const subform = subforms.find((w) => w.id === cfg.subformWidgetId);
  const subFields = (subform?.config?.fields as SubField[]) ?? [];
  const displayFields = (cfg.displayFields as string[]) ?? [];

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
              subformWidgetId: "",
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
          <label style={LABEL}>Subformulario de actividades</label>
          {subforms.length === 0 ? (
            <p style={{ ...HINT, color: "#ef4444" }}>
              Ese formulario no tiene un subformulario. Agrega uno con las
              actividades.
            </p>
          ) : (
            <select
              style={INPUT}
              value={(cfg.subformWidgetId as string) ?? ""}
              onChange={(e) =>
                set({ subformWidgetId: e.target.value, displayFields: [] })
              }
            >
              <option value="">-- Selecciona --</option>
              {subforms.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
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
