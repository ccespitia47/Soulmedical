import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Más opciones"
        className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[5px] border-none"
        style={{
          background: open ? T.bgHover : "transparent",
          color: T.textMuted,
        }}
      >
        <Icon name="more" size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[170px] rounded-lg border p-1 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          style={{ background: T.bgElev, borderColor: T.border }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[5px] border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-medium font-sans"
              style={{ color: it.destructive ? "#f87171" : T.text }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = T.bgHover;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {it.icon && <Icon name={it.icon} size={14} />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
