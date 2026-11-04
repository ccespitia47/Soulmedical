import { useEffect, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";
import {
  getPendingActivitiesApi,
  type PendingActivity,
} from "../../../services/api";

/**
 * Convierte un valor del data del formulario a texto legible para el
 * usuario. Salta data URLs y referencias gridfs (son firmas/fotos — no
 * texto). Arrays se unen con coma. El resto se convierte a string.
 */
function show(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    if (value.startsWith("data:") || value.startsWith("gridfs:")) return "";
    return value;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * Render en tiempo de ejecución (cuando el usuario está completando el
 * formulario de Cumplimiento). Fetchea las actividades pendientes del
 * usuario logueado cada vez que cambia planningFormId/subformWidgetId.
 * El `<input type="hidden" name={widget.id}>` lleva el JSON serializado
 * de las keys seleccionadas, que el backend valida y guarda en
 * `completesActivities`.
 */
export default function PendingActivityRender({ widget }: WidgetRenderProps) {
  const cfg = widget.config;
  const planningFormId = (cfg.planningFormId as string) ?? "";
  const subformWidgetId = (cfg.subformWidgetId as string) ?? "";
  const displayFields = (cfg.displayFields as string[]) ?? [];
  const allowMultiple = (cfg.allowMultiple as boolean) ?? true;

  const [items, setItems] = useState<PendingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!planningFormId || !subformWidgetId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPendingActivitiesApi(planningFormId, subformWidgetId).then((r) => {
      if (cancelled) return;
      if (r.data) setItems(r.data);
      else setError(r.error ?? "No se pudieron cargar las actividades");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [planningFormId, subformWidgetId]);

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : allowMultiple
        ? [...prev, key]
        : [key],
    );

  const title = (a: PendingActivity) =>
    show(a.fields[displayFields[0]]) || `Actividad ${a.index + 1}`;
  const details = (a: PendingActivity) =>
    displayFields
      .slice(1)
      .map((id) => show(a.fields[id]))
      .filter(Boolean)
      .join(" · ");

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {widget.label}
        {widget.required && (
          <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>
        )}
      </label>

      {/* Vacío cuando no hay selección → la validación HTML de "obligatorio"
          marca el formulario como inválido sin selección. */}
      <input
        type="hidden"
        name={widget.id}
        value={selected.length ? JSON.stringify(selected) : ""}
      />

      {!planningFormId || !subformWidgetId ? (
        <p style={{ fontSize: 12.5, color: "#ef4444" }}>
          Este campo no está configurado.
        </p>
      ) : loading ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>
          Cargando tus actividades...
        </p>
      ) : error ? (
        <p style={{ fontSize: 13, color: "#ef4444" }}>⚠️ {error}</p>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: "16px 12px",
            border: "1.5px dashed #e2e8f0",
            borderRadius: 8,
            textAlign: "center",
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          ✅ No tienes actividades pendientes.
        </div>
      ) : (
        <div
          style={{
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {items.map((a) => {
            const on = selected.includes(a.key);
            return (
              <label
                key={a.key}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  // Selección usa el verde del brand (#f0fdf4 == tailwind
                  // green-50) para match con otros checks del app.
                  background: on ? "#f0fdf4" : "white",
                  transition: "background 0.15s ease",
                }}
              >
                <input
                  type={allowMultiple ? "checkbox" : "radio"}
                  checked={on}
                  onChange={() => toggle(a.key)}
                  style={{ marginTop: 3 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {title(a)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                    {details(a) && <>{details(a)} · </>}
                    Planeada el{" "}
                    {new Date(a.plannedAt).toLocaleDateString("es-CO")}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5 }}>
          {selected.length} de {items.length} seleccionada(s)
        </p>
      )}
    </div>
  );
}
