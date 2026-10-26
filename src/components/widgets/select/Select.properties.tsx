import { useRef, useState } from "react";
import type { WidgetPropertiesProps } from "../../../types/widget.types";

/**
 * Panel de propiedades del widget "Desplegable" (Select). Expone:
 *
 * - Etiqueta, Placeholder, Opciones (reordenables por drag ☰, borrables por ×)
 * - Valor predeterminado (dropdown con opciones actuales; multi si multiple=true)
 * - Ordenar alfabéticamente (aplica a builder y a render)
 * - Permitir múltiples selecciones
 * - Expandir (renderiza como radios/checkboxes visibles en vez de <select>)
 * - Obligatorio
 * - Recordar entrada (guarda última selección en localStorage por widget.id)
 *
 * Cada checkbox trae ⓘ con tooltip (title HTML nativo) que explica su efecto.
 */
export default function SelectProperties({ widget, updateWidget }: WidgetPropertiesProps) {
  const rawOptions = (widget.config.options as string[]) || [];
  const sortAlphabetically = (widget.config.sortAlphabetically as boolean) ?? false;
  const multiple = (widget.config.multiple as boolean) ?? false;
  const expand = (widget.config.expand as boolean) ?? false;
  const rememberEntry = (widget.config.rememberEntry as boolean) ?? false;
  const defaultValue = widget.config.defaultValue as string | string[] | undefined;

  // Cuando "Ordenar alfabéticamente" está activo, mostramos también en el
  // panel las opciones ordenadas — así el admin ve exactamente lo que verá
  // el usuario final.
  const options = sortAlphabetically
    ? [...rawOptions].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    : rawOptions;

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const inputStyle = {
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

  const labelStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600 as const,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 5,
  };

  const patchConfig = (patch: Record<string, unknown>) => {
    updateWidget(widget.id, { config: { ...widget.config, ...patch } });
  };

  const updateOptions = (newOptions: string[]) => {
    // Si defaultValue ya no está entre las opciones válidas, lo limpiamos
    // para evitar valores fantasma en el render.
    let nextDefault = defaultValue;
    if (Array.isArray(nextDefault)) {
      nextDefault = nextDefault.filter((v) => newOptions.includes(v));
    } else if (typeof nextDefault === "string" && !newOptions.includes(nextDefault)) {
      nextDefault = "";
    }
    patchConfig({ options: newOptions, defaultValue: nextDefault });
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    // Reorder trabaja siempre sobre rawOptions (la fuente de verdad), NO sobre
    // la vista ordenada — si sortAlphabetically está activo, arrastrar no
    // tiene efecto persistente porque el orden alfa manda al render.
    const next = [...rawOptions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    patchConfig({ options: next });
  };

  // Handler común de los checkboxes con tooltip ⓘ
  const CheckRow = ({
    id,
    label,
    tooltip,
    checked,
    onChange,
  }: {
    id: string;
    label: string;
    tooltip: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "#111827",
        cursor: "pointer",
        padding: "6px 0",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span style={{ flex: 1 }}>{label}</span>
      <span
        title={tooltip}
        aria-label={tooltip}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid #cbd5e1",
          color: "#6b7280",
          fontSize: 10,
          fontWeight: 600,
          cursor: "help",
          userSelect: "none",
        }}
      >
        i
      </span>
    </label>
  );

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Etiqueta</label>
        <input
          style={inputStyle}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Placeholder</label>
        <input
          style={inputStyle}
          value={(widget.config.placeholder as string) || ""}
          onChange={(e) => patchConfig({ placeholder: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Opciones</label>
          <span
            title="Cada opción del desplegable. Arrastra ☰ para reordenar y × para eliminar."
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "1px solid #cbd5e1",
              color: "#6b7280",
              fontSize: 9,
              cursor: "help",
            }}
          >
            i
          </span>
        </div>

        {options.map((option, index) => {
          // Cuando la vista está ordenada alfa, resolvemos el índice REAL en
          // rawOptions para que edit/delete/drag apunten al item correcto.
          const realIndex = sortAlphabetically
            ? rawOptions.indexOf(option)
            : index;
          const isDragging = dragIdx === realIndex;
          return (
            // key SOLO por realIndex: incluir `option` haría que React
            // desmontara el <input> en cada tecla (porque la key cambia con
            // el texto) y el foco se perdería letra por letra.
            <div
              key={realIndex}
              draggable={!sortAlphabetically}
              onDragStart={() => setDragIdx(realIndex)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null) reorder(dragIdx, realIndex);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                opacity: isDragging ? 0.5 : 1,
              }}
            >
              <span
                title={
                  sortAlphabetically
                    ? "Desactiva 'Ordenar alfabéticamente' para reordenar manualmente"
                    : "Arrastra para reordenar"
                }
                style={{
                  cursor: sortAlphabetically ? "not-allowed" : "grab",
                  color: sortAlphabetically ? "#cbd5e1" : "#94a3b8",
                  fontSize: 14,
                  userSelect: "none",
                  padding: "0 4px",
                }}
              >
                ☰
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[realIndex] = el;
                }}
                style={{ ...inputStyle, flex: 1 }}
                value={option}
                onChange={(e) => {
                  const next = [...rawOptions];
                  next[realIndex] = e.target.value;
                  updateOptions(next);
                }}
              />
              <button
                type="button"
                title="Eliminar"
                onClick={() =>
                  updateOptions(rawOptions.filter((_, i) => i !== realIndex))
                }
                style={{
                  width: 28,
                  height: 28,
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 6,
                  backgroundColor: "#fff",
                  color: "#94a3b8",
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const next = [...rawOptions, `Opción ${rawOptions.length + 1}`];
            updateOptions(next);
            // Foco inmediato en el nuevo input para que el admin pueda tipear
            setTimeout(() => {
              const el = inputRefs.current[next.length - 1];
              el?.focus();
              el?.select();
            }, 0);
          }}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1.5px solid #e2e8f0",
            borderRadius: 6,
            backgroundColor: "#fff",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          Añadir
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Valor predeterminado</label>
        {multiple ? (
          <select
            multiple
            value={Array.isArray(defaultValue) ? defaultValue : []}
            onChange={(e) => {
              const picked = Array.from(e.target.selectedOptions).map(
                (o) => o.value,
              );
              patchConfig({ defaultValue: picked });
            }}
            style={{
              ...inputStyle,
              minHeight: 80,
              padding: "6px 8px",
              backgroundColor: "#fff",
            }}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={typeof defaultValue === "string" ? defaultValue : ""}
            onChange={(e) => patchConfig({ defaultValue: e.target.value })}
            style={{ ...inputStyle, backgroundColor: "#fff" }}
          >
            <option value="">— Sin valor —</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </div>

      <CheckRow
        id={`sort-${widget.id}`}
        label="Ordenar alfabéticamente"
        tooltip="Muestra las opciones ordenadas A→Z tanto en el editor como en el formulario final."
        checked={sortAlphabetically}
        onChange={(v) => patchConfig({ sortAlphabetically: v })}
      />

      <CheckRow
        id={`multi-${widget.id}`}
        label="Permitir múltiples selecciones"
        tooltip="El usuario podrá seleccionar más de una opción a la vez."
        checked={multiple}
        onChange={(v) => {
          // Al alternar multi/single, resetear defaultValue al tipo correcto
          // para evitar arrays cuando el schema espera string y viceversa.
          patchConfig({
            multiple: v,
            defaultValue: v ? [] : "",
          });
        }}
      />

      <CheckRow
        id={`expand-${widget.id}`}
        label="Expandir"
        tooltip="Muestra todas las opciones visibles como radios (o checkboxes si permite múltiples) en vez del desplegable."
        checked={expand}
        onChange={(v) => patchConfig({ expand: v })}
      />

      <CheckRow
        id={`required-${widget.id}`}
        label="Obligatorio"
        tooltip="El formulario no se puede enviar si este campo está vacío."
        checked={widget.required}
        onChange={(v) => updateWidget(widget.id, { required: v })}
      />

      <CheckRow
        id={`remember-${widget.id}`}
        label="Recordar entrada"
        tooltip="La próxima vez que este mismo navegador abra el formulario, viene pre-seleccionado con la última opción usada."
        checked={rememberEntry}
        onChange={(v) => patchConfig({ rememberEntry: v })}
      />
    </>
  );
}
