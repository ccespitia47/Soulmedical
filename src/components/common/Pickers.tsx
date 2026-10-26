import { useMemo, useState } from "react";
import Icon from "./Icon";
import EntityIcon, { resolveIconName } from "./EntityIcon";
import { COLOMBIA_ICONS } from "../../types/colombia-icons";

const ACCENT = "#00c2a8";
const ACCENT_50 = "rgba(0, 194, 168, 0.10)";

type ColorOption = { id: string; label: string; value: string };
type IconOption = { id: string; label: string };

export function ColorPicker({
  selected,
  onChange,
  colors,
}: {
  selected: string;
  onChange: (v: string) => void;
  colors: ColorOption[];
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2.5">
      {colors.map((c) => {
        const active = selected === c.value;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.value)}
            title={c.label}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-110"
            style={{
              background: c.value,
              boxShadow: active
                ? `0 0 0 3px #fff, 0 0 0 5px ${c.value}, 0 6px 14px -4px ${c.value}99`
                : `0 2px 6px -2px ${c.value}66`,
            }}
          >
            {active && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function IconPicker({
  selected,
  onChange,
  icons,
}: {
  selected: string;
  onChange: (v: string) => void;
  icons: IconOption[];
}) {
  // `selected` puede ser un emoji legado; lo normalizamos para resaltar bien.
  const selectedKey = resolveIconName(selected);
  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {icons.map((ic) => {
          const isSel = selectedKey === ic.id;
          return (
            <button
              key={ic.id}
              onClick={() => onChange(ic.id)}
              title={ic.label}
              className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-105"
              style={{
                border: isSel ? `2px solid ${ACCENT}` : "2px solid #e2e8f0",
                background: isSel ? ACCENT_50 : "#fff",
                color: isSel ? ACCENT : "#64748b",
                boxShadow: isSel
                  ? "0 6px 16px -6px rgba(0,194,168,0.5)"
                  : "0 1px 3px rgba(15,45,90,0.05)",
              }}
            >
              <Icon name={ic.id} size={20} />
            </button>
          );
        })}
      </div>

      <ColombiaIconsSection selected={selected} onChange={onChange} />
    </div>
  );
}

/**
 * Sección adicional con el catálogo completo de @mteherandev/colombia-icons-react.
 * Se renderiza colapsada por defecto para no abrumar; al expandir muestra un
 * buscador y una grilla con los 270+ íconos. Al elegir uno, el `onChange`
 * recibe un id con prefijo `ci:` que EntityIcon sabe renderizar.
 *
 * Export para que otros selectores de ícono (GroupFormModal, por ejemplo)
 * puedan incluir la misma sección sin duplicar código.
 */
export function ColombiaIconsSection({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => selected?.startsWith("ci:") ?? false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COLOMBIA_ICONS;
    return COLOMBIA_ICONS.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.componentName.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-slate-700"
      >
        <span className="flex items-center gap-2">
          🇨🇴 Colombia Icons
          <span className="text-[11px] font-normal text-slate-400">
            ({COLOMBIA_ICONS.length} íconos adicionales)
          </span>
        </span>
        <span className="text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: carpeta, usuario, bandeja paisa…"
            className="mb-2 w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#00c2a8]"
          />
          <div className="grid max-h-[260px] grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-10">
            {filtered.map((e) => {
              const isSel = selected === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onChange(e.id)}
                  title={e.label}
                  className="flex h-[36px] w-[36px] cursor-pointer items-center justify-center rounded-lg transition-colors"
                  style={{
                    border: isSel ? `2px solid ${ACCENT}` : "1.5px solid #e2e8f0",
                    background: isSel ? ACCENT_50 : "#fff",
                    color: isSel ? ACCENT : "#475569",
                  }}
                >
                  <EntityIcon icon={e.id} size={18} />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-6 text-center text-[12px] text-slate-400">
                Sin resultados para "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
