import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SubformFieldType } from "../subform.types";
import Icon from "../../../common/Icon";
import { FIELD_TYPES, SUBFORM_FIELD_ICONS } from "./constants";

// Agrupación visual: refleja la paleta de widgets del builder principal
// para que la elección de tipo se sienta familiar al usuario.
const CATEGORIES: { label: string; types: SubformFieldType[] }[] = [
  { label: "Básicos",    types: ["text", "textarea", "number", "price", "email", "phone", "date", "time", "idDocument"] },
  { label: "Selección",  types: ["select", "checkbox", "radio"] },
  { label: "Avanzados",  types: ["search", "signature", "photo", "file", "video", "barcode", "idscanner", "calc"] },
  { label: "Diseño",     types: ["header", "htmlblock", "image"] },
  { label: "Evaluación", types: ["quiz_question", "quiz_score"] },
];

type Props = {
  value: SubformFieldType;
  onChange: (value: SubformFieldType) => void;
};

type PanelPos = { top: number; left: number; width: number; placement: "below" | "above" };

export default function SubformFieldTypeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = FIELD_TYPES.find((t) => t.value === value);
  const selectedIcon = SUBFORM_FIELD_ICONS[value] ?? "grid";

  // Reposiciona el panel: debajo del trigger por defecto, arriba si no cabe.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelMax = 380;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: "below" | "above" =
        spaceBelow < panelMax && rect.top > panelMax ? "above" : "below";
      setPos({
        top: placement === "below" ? rect.bottom + 6 : rect.top - 6,
        left: rect.left,
        width: rect.width,
        placement,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerBorder = open ? "#00c2a8" : "#e2e8f0";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="box-border flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-2 py-1.5 text-left font-sans text-sm text-slate-900 outline-none transition-colors hover:border-slate-300"
        style={{
          borderColor: triggerBorder,
          boxShadow: open ? "0 0 0 3px rgba(0,194,168,0.15)" : undefined,
        }}
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-white shadow-[0_4px_10px_-4px_rgba(0,194,168,0.55)]">
          <Icon name={selectedIcon} size={14} />
        </span>
        <span className="flex-1 truncate text-[13px] font-semibold text-slate-800">
          {selected?.label ?? value}
        </span>
        <Icon
          name="caretDown"
          size={13}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={panelRef}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            role="listbox"
            style={{
              position: "fixed",
              top: pos.placement === "below" ? pos.top : undefined,
              bottom:
                pos.placement === "above"
                  ? window.innerHeight - pos.top
                  : undefined,
              left: pos.left,
              width: pos.width,
              zIndex: 1200,
              boxShadow:
                "0 24px 60px -12px rgba(15,23,42,0.25), 0 2px 6px rgba(15,23,42,0.08)",
            }}
          >
            <div className="max-h-[360px] overflow-y-auto px-1.5 py-1.5">
              {CATEGORIES.map((cat) => (
                <div key={cat.label} className="mb-0.5">
                  <div className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {cat.label}
                  </div>
                  {cat.types.map((t) => {
                    const info = FIELD_TYPES.find((f) => f.value === t);
                    if (!info) return null;
                    const iconName = SUBFORM_FIELD_ICONS[t] ?? "grid";
                    const isSelected = t === value;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(t);
                          setOpen(false);
                        }}
                        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[#f0fdfa]"
                        style={{
                          background: isSelected ? "#e6faf7" : undefined,
                        }}
                      >
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors"
                          style={{
                            background: isSelected
                              ? "rgba(0,194,168,0.18)"
                              : "#f1f5f9",
                            color: isSelected ? "#0891b2" : "#475569",
                            border: `1px solid ${
                              isSelected ? "rgba(0,194,168,0.35)" : "transparent"
                            }`,
                          }}
                        >
                          <Icon name={iconName} size={14} />
                        </span>
                        <span
                          className="flex-1 truncate font-semibold"
                          style={{ color: isSelected ? "#0891b2" : "#334155" }}
                        >
                          {info.label}
                        </span>
                        {isSelected && (
                          <Icon
                            name="check"
                            size={14}
                            className="text-[#0891b2]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
