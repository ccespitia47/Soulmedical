import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ThemeTokens } from "../../context/ThemeContext";
import Icon from "./Icon";

export type MenuItem = {
  label: string;
  icon?: string;
  onClick: () => void;
  destructive?: boolean;
};

type PopoverMenuProps = {
  items: MenuItem[];
  T: ThemeTokens;
};

export default function PopoverMenu({ items, T }: PopoverMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  };

  // Si el menú no cabe hacia abajo (p. ej. el botón está al final del sidebar),
  // reposicionamos arriba del botón para que no quede cortado por el viewport.
  // Se mide después del render porque la altura real depende de cuántos items
  // haya. useLayoutEffect evita el "flash" de verlo abajo y luego saltar.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!btn || !menu) return;
    const spaceBelow = window.innerHeight - btn.bottom;
    const needsFlip = menu.height + 12 > spaceBelow && btn.top > menu.height + 12;
    if (needsFlip) {
      setPos((p) => ({ ...p, top: Math.max(8, btn.top - menu.height - 6) }));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    // Cerrar al hacer scroll para que el menú (posición fija) no quede desalineado.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        title="Más opciones"
        aria-label="Más opciones"
        className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-lg border transition-all duration-150"
        style={{
          background: open ? "rgba(0,194,168,0.12)" : T.bgElev,
          borderColor: open ? "#00c2a8" : T.border,
          color: open ? "#0891b2" : T.text,
        }}
        onMouseOver={(e) => {
          if (!open) {
            e.currentTarget.style.background = "rgba(0,194,168,0.10)";
            e.currentTarget.style.borderColor = "rgba(0,194,168,0.45)";
            e.currentTarget.style.color = "#0891b2";
          }
        }}
        onMouseOut={(e) => {
          if (!open) {
            e.currentTarget.style.background = T.bgElev;
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.text;
          }
        }}
      >
        <Icon name="more" size={17} strokeWidth={2.6} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="animate-modal-in fixed z-[999] min-w-[192px] rounded-xl border p-1.5 font-sans shadow-[0_18px_44px_-12px_rgba(15,23,42,0.4)] backdrop-blur-sm"
            style={{ top: pos.top, right: pos.right, background: T.bgElev, borderColor: T.border }}
          >
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-150"
                style={{ color: it.destructive ? "#f87171" : T.text }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = it.destructive ? "rgba(248,113,113,0.12)" : T.bgHover;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {it.icon && (
                  <span style={{ color: it.destructive ? "#f87171" : T.textMuted }}>
                    <Icon name={it.icon} size={15} />
                  </span>
                )}
                <span>{it.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
