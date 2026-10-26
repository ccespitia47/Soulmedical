import { useEffect, useRef, useState } from "react";
import type { WidgetRenderProps } from "../../../types/widget.types";

const REMEMBER_KEY = (widgetId: string) => `soulforms-select:${widgetId}`;

/**
 * Renderiza el widget "Desplegable" en el formulario final. Soporta:
 *
 *  - Selección única / múltiple (`multiple`)
 *  - Modo compacto (<select>) o expandido con radios/checkboxes (`expand`)
 *  - Orden alfabético (`sortAlphabetically`)
 *  - Valor predeterminado (`defaultValue`)
 *  - Recordar entrada por navegador (`rememberEntry`) — guarda la selección
 *    en localStorage bajo la clave `soulforms-select:<widget.id>`.
 *
 * El estado local (`selected`) se sincroniza con inputs ocultos (`<input
 * type="hidden">`) para que FormData del `<form>` externo lo recoja igual
 * que un <select> nativo. Para modo múltiple emite un hidden por valor
 * seleccionado, y FormData.getAll(name) devuelve el array.
 */
export default function SelectRender({ widget, hiddenWidgetIds }: WidgetRenderProps) {
  const rawOptions = (widget.config.options as string[]) || [];
  const sortAlphabetically = (widget.config.sortAlphabetically as boolean) ?? false;
  const multiple = (widget.config.multiple as boolean) ?? false;
  const expand = (widget.config.expand as boolean) ?? false;
  const rememberEntry = (widget.config.rememberEntry as boolean) ?? false;
  const placeholder =
    (widget.config.placeholder as string) || "Selecciona una opción";
  const defaultValue = widget.config.defaultValue;

  // Filtra opciones ocultas por reglas condicionales. El ID compuesto
  // `${widget.id}::${opt}` es el que RuleTargetSelector escribe en
  // `targetWidgetIds` para que una regla pueda ocultar una opción puntual.
  const visibleRawOptions = hiddenWidgetIds
    ? rawOptions.filter((opt) => !hiddenWidgetIds.has(`${widget.id}::${opt}`))
    : rawOptions;

  const options = sortAlphabetically
    ? [...visibleRawOptions].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      )
    : visibleRawOptions;

  // Semilla inicial: localStorage (si rememberEntry) → defaultValue → vacío.
  const initial = useRef<string[]>([]);
  if (initial.current.length === 0) {
    let seed: string[] = [];
    if (rememberEntry) {
      try {
        const raw = localStorage.getItem(REMEMBER_KEY(widget.id));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) seed = parsed.filter((v) => typeof v === "string");
          else if (typeof parsed === "string") seed = [parsed];
        }
      } catch {
        /* localStorage no disponible — sigue con defaultValue */
      }
    }
    if (seed.length === 0 && defaultValue) {
      if (Array.isArray(defaultValue)) {
        seed = defaultValue.filter((v): v is string => typeof v === "string");
      } else if (typeof defaultValue === "string" && defaultValue) {
        seed = [defaultValue];
      }
    }
    // Filtrar cualquier valor que ya no exista en options (por si el admin
    // borró la opción después de que el usuario la guardó).
    initial.current = seed.filter((v) => options.includes(v));
    // En modo single, forzar máximo 1 seed.
    if (!multiple && initial.current.length > 1) {
      initial.current = [initial.current[0]];
    }
  }

  const [selected, setSelected] = useState<string[]>(initial.current);

  // Persistir en localStorage cuando `rememberEntry` esté activo y haya
  // cambios. Usamos JSON siempre — array en multi, string en single — y
  // limpiamos la key si el usuario vació la selección.
  useEffect(() => {
    if (!rememberEntry) return;
    try {
      if (selected.length === 0) {
        localStorage.removeItem(REMEMBER_KEY(widget.id));
      } else {
        const toSave = multiple ? selected : selected[0];
        localStorage.setItem(REMEMBER_KEY(widget.id), JSON.stringify(toSave));
      }
    } catch {
      /* no-op */
    }
  }, [selected, rememberEntry, multiple, widget.id]);

  const labelEl = (
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
  );

  // Hidden inputs para que FormData externo recoja los valores. En multi,
  // emitimos uno por valor (getAll(name) devuelve array). En single, uno.
  const hiddenInputs =
    selected.length === 0 ? (
      <input type="hidden" name={widget.id} value="" />
    ) : (
      selected.map((v, i) => (
        <input key={`${v}-${i}`} type="hidden" name={widget.id} value={v} />
      ))
    );

  // ── Modo EXPANDIDO: radios (single) o checkboxes (multi) ────────────────
  if (expand) {
    const toggleMulti = (opt: string, checked: boolean) => {
      setSelected((prev) =>
        checked ? [...prev, opt] : prev.filter((v) => v !== opt),
      );
    };
    const pickSingle = (opt: string) => setSelected([opt]);

    return (
      <div>
        {labelEl}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <label
                key={opt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13.5,
                  backgroundColor: isChecked ? "#f0fdfa" : "#fff",
                }}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`${widget.id}__ui`}
                  value={opt}
                  checked={isChecked}
                  required={
                    // Sólo el primer radio marca required en radios (nativamente
                    // el grupo comparte required). En checkboxes, required no
                    // valida grupos — se cubre en validación externa.
                    !multiple && widget.required
                  }
                  onChange={(e) =>
                    multiple ? toggleMulti(opt, e.target.checked) : pickSingle(opt)
                  }
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
        {hiddenInputs}
      </div>
    );
  }

  // ── Modo compacto: <select> nativo (single o multiple) ──────────────────
  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      const picked = Array.from(e.target.selectedOptions).map((o) => o.value);
      setSelected(picked);
    } else {
      setSelected(e.target.value ? [e.target.value] : []);
    }
  };

  return (
    <div>
      {labelEl}
      <select
        // UI-only: el nombre real lo llevan los hidden inputs para unificar
        // el shape (single vs multi) que consume FormData.
        name={`${widget.id}__ui`}
        multiple={multiple}
        required={widget.required && !multiple}
        value={multiple ? selected : selected[0] ?? ""}
        onChange={onSelectChange}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 6,
          fontSize: 13.5,
          boxSizing: "border-box",
          color: "#111827",
          backgroundColor: "#fff",
          minHeight: multiple ? 120 : undefined,
        }}
      >
        {!multiple && (
          <option value="" disabled={widget.required}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {hiddenInputs}
    </div>
  );
}
