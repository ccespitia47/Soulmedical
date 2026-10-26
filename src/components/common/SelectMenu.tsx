import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export type SelectOption = {
  value: string;
  label: string;
  /** Color de acento (punto a la izquierda). Opcional. */
  color?: string;
};

type SelectMenuProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Icono a la izquierda del trigger. */
  leftIcon?: string;
  /**
   * Muestra el buscador dentro de la lista. Por defecto se activa solo cuando
   * hay más de 8 opciones.
   */
  searchable?: boolean;
  /** Deshabilita el control (no se abre). */
  disabled?: boolean;
};

/**
 * Dropdown estilizado que reemplaza a `<select>` nativo conservando el mismo
 * contrato (value + onChange). La lista se renderiza vía portal para escapar de
 * cualquier overflow/stacking-context y poder aplicarle diseño propio (algo
 * imposible con el `<option>` nativo, que dibuja el sistema operativo).
 */
export default function SelectMenu({
  value,
  onChange,
  options,
  leftIcon,
  searchable,
  disabled = false,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Al abrir: limpiar búsqueda y enfocar el buscador.
  useEffect(() => {
    if (open) {
      setQuery("");
      if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    // Reposiciona al hacer scroll de la página, pero ignora el scroll interno
    // de la propia lista (ese debe poder moverse sin cerrar el menú).
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      place();
    };
    const onResize = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border-[1.5px] bg-white py-2.5 pl-3 pr-2.5 text-left text-[13px] font-medium text-gray-900 shadow-sm outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:hover:border-slate-200 enabled:cursor-pointer"
        style={{
          borderColor: open ? "#00c2a8" : "#e2e8f0",
          boxShadow: open ? "0 0 0 3px rgba(0,194,168,0.15)" : undefined,
        }}
      >
        {leftIcon && (
          <span
            className="flex-shrink-0 transition-colors"
            style={{ color: open ? "#00c2a8" : "#94a3b8" }}
          >
            <Icon name={leftIcon} size={15} />
          </span>
        )}
        {selected?.color && (
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: selected.color }}
          />
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <span
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            color: open ? "#00c2a8" : "#94a3b8",
            transform: open ? "rotate(180deg)" : "none",
          }}
        >
          <Icon name="caretDown" size={16} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="animate-modal-in fixed z-[999] flex max-h-[340px] flex-col rounded-xl border border-slate-200 bg-white font-sans shadow-[0_18px_44px_-12px_rgba(15,40,80,0.35)]"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {showSearch && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="search" size={14} />
                  </span>
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-lg border-[1.5px] border-slate-200 bg-slate-50 py-2 pl-8 pr-2.5 text-[13px] text-gray-900 outline-none transition focus:border-[#00c2a8] focus:bg-white focus:ring-2 focus:ring-[#00c2a8]/15"
                  />
                </div>
              </div>
            )}
            <div className="overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="px-2.5 py-4 text-center text-[12.5px] text-slate-400">
                  Sin resultados
                </div>
              ) : (
                filtered.map((o) => {
                  const active = o.value === value;
                  return (
                    <button
                      key={o.value || "__all__"}
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left text-[13px] transition-colors"
                      style={{
                        background: active ? "rgba(0,194,168,0.1)" : "transparent",
                        color: active ? "#0891b2" : "#334155",
                        fontWeight: active ? 600 : 500,
                      }}
                      onMouseOver={(e) => {
                        if (!active) e.currentTarget.style.background = "#f1f5f9";
                      }}
                      onMouseOut={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {o.color ? (
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: o.color }}
                        />
                      ) : (
                        <span className="h-2 w-2 flex-shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {active && (
                        <Icon
                          name="checkCircle"
                          size={15}
                          className="flex-shrink-0 text-[#00c2a8]"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
