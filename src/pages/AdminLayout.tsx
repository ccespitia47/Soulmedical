import { useState } from "react";
import HomePage from "./HomePage";
import UsersPage from "./UsersPage";
import type { AuthUser } from "../types/auth.types";
import logo from "../assets/Logo_GrupoSoul.png";

type AdminSection = "formularios" | "usuarios";

type AdminLayoutProps = {
  currentUser: Pick<AuthUser, "name" | "role" | "avatar">;
  onOpenBuilder: (folderId: string, formId: string) => void;
  onOpenForm: (folderId: string, formId: string) => void;
  onSwitchToUserApp: () => void;
  onLogout: () => void;
};

const NAV_ITEMS: { id: AdminSection; icon: string; label: string }[] = [
  { id: "formularios", icon: "📋", label: "Formularios" },
  { id: "usuarios", icon: "👥", label: "Usuarios" },
];

export default function AdminLayout({
  currentUser,
  onOpenBuilder,
  onOpenForm,
  onSwitchToUserApp,
  onLogout,
}: AdminLayoutProps) {
  const [section, setSection] = useState<AdminSection>("formularios");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Sidebar CLARO ── */}
      <aside style={{
        width: 220, minHeight: "100vh", background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50,
      }}>

        {/* Logo */}
        <div style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <img src={logo} alt="Grupo Soul" style={{ height: 32, objectFit: "contain" }} />
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Formularios</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <div key={item.id} onClick={() => setSection(item.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px", borderRadius: 8, marginBottom: 2,
                background: active ? "#e6faf7" : "transparent",
                borderLeft: active ? "3px solid #00c2a8" : "3px solid transparent",
                cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseOver={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 17 }}>{item.icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? "#00c2a8" : "#6b7280",
                }}>
                  {item.label}
                </span>
              </div>
            );
          })}

          {/* Separador */}
          <div style={{ height: 1, background: "#e2e8f0", margin: "12px 8px" }} />

          {/* Vista App */}
          <div onClick={onSwitchToUserApp} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", borderRadius: 8,
            cursor: "pointer", transition: "all 0.15s",
            borderLeft: "3px solid transparent",
          }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 17 }}>📱</span>
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Vista App</span>
          </div>
        </nav>

        {/* Footer: usuario + versión + cerrar sesión */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0" }}>

          {/* Info usuario */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", background: "#f8fafc",
            borderRadius: 8, marginBottom: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #00c2a8, #0891b2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              {currentUser.avatar}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "capitalize" }}>
                {currentUser.role}
              </div>
            </div>
          </div>

          {/* Cerrar sesión */}
          <button onClick={onLogout} style={{
            width: "100%", padding: "8px 14px",
            background: "none", color: "#ef4444",
            border: "1.5px solid #fecaca", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 6, transition: "all 0.15s",
            marginBottom: 8,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#fecaca"; }}
          >
            🚪 Cerrar sesión
          </button>

          {/* Versión */}
          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
            SoulForms v1.0
          </div>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main style={{ flex: 1, marginLeft: 220, minHeight: "100vh", background: "#f0f4f8" }}>
        {section === "formularios" && (
          <HomePage
            onOpenBuilder={onOpenBuilder}
            onOpenForm={onOpenForm}
            onLogout={onLogout}
            currentUser={currentUser}
            onSwitchToUserApp={onSwitchToUserApp}
          />
        )}
        {section === "usuarios" && <UsersPage />}
      </main>
    </div>
  );
}