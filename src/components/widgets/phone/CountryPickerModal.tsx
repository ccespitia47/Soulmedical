import { useState, useMemo } from "react";
import { COUNTRIES, type Country } from "../../../lib/countries";

type Props = {
  selectedCode: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

export default function CountryPickerModal({ selectedCode, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [query]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "90%",
          maxWidth: 380,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Seleccionar país
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: "#6b7280",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
          <input
            autoFocus
            type="text"
            placeholder="Buscar por nombre o código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1.5px solid #e2e8f0",
              borderRadius: 6,
              fontSize: 13.5,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Sin resultados
            </p>
          ) : (
            filtered.map((c) => {
              const isSelected = c.code === selectedCode;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onSelect(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    background: isSelected ? "#f0fdfa" : "transparent",
                    cursor: "pointer",
                    fontSize: 13.5,
                    color: "#111827",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ color: "#6b7280", fontFamily: "monospace" }}>{c.dialCode}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
