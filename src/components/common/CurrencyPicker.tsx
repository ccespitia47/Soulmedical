import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { CURRENCIES, CURRENCY_MAP, type CurrencyDef } from "../../lib/currencies";

type Props = {
  value: string;
  onChange: (code: string) => void;
};

/**
 * Combobox de monedas ISO 4217. Sin dependencias externas — filtro
 * client-side por código, nombre o símbolo. Colapsa al hacer clic
 * fuera o al elegir una opción.
 */
export default function CurrencyPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected: CurrencyDef | undefined = CURRENCY_MAP[value];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Foco al input al abrir para que el usuario tipeé directo.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 7,
          fontSize: 13.5,
          fontFamily: "inherit",
          backgroundColor: "#f8fafc",
          color: "#111827",
          boxSizing: "border-box",
          outline: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          {selected ? (
            <>
              <span
                style={{
                  color: "#0891b2",
                  fontWeight: 700,
                  minWidth: 30,
                  fontFamily: "monospace",
                }}
              >
                {selected.symbol}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selected.code} — {selected.name}
              </span>
            </>
          ) : (
            <span style={{ color: "#94a3b8" }}>Elige una moneda…</span>
          )}
        </span>
        <Icon name="caretDown" size={13} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 10px 30px -12px rgba(15,40,80,0.25)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: 320,
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: "1px solid #e2e8f0",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                display: "flex",
              }}
            >
              <Icon name="search" size={13} />
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar (código, nombre, símbolo)…"
              style={{
                width: "100%",
                padding: "7px 10px 7px 28px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "inherit",
                background: "#f8fafc",
                color: "#111827",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && (
              <p
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: "#94a3b8",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Sin resultados
              </p>
            )}
            {filtered.map((c) => {
              const active = c.code === value;
              return (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => pick(c.code)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    background: active ? "#ecfeff" : "white",
                    color: "#111827",
                    fontSize: 13,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                  onMouseOver={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#f8fafc";
                  }}
                  onMouseOut={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "white";
                  }}
                >
                  <span
                    style={{
                      color: "#0891b2",
                      fontWeight: 700,
                      minWidth: 32,
                      fontFamily: "monospace",
                    }}
                  >
                    {c.symbol}
                  </span>
                  <span style={{ fontWeight: 600, minWidth: 44 }}>{c.code}</span>
                  <span
                    style={{
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
