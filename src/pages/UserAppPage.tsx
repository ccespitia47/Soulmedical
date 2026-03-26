import { useState } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";
import type { AuthUser } from "../types/auth.types";
import logo from "../assets/Logo_GrupoSoul.png";

// Usamos Pick para aceptar tanto AuthUser como AppUser
type UserForApp = Pick<AuthUser, "name" | "role" | "avatar" | "assignments"> & { id?: string; email?: string };

type UserAppPageProps = {
  user: UserForApp;
  onFillForm: (folderId: string, formId: string) => void;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
};

export default function UserAppPage({ user, onFillForm, onLogout, onSwitchToAdmin }: UserAppPageProps) {
  const { folders } = useFolderStore();
  const { projects } = useProjectStore();

  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // ── Filtrar carpetas/formularios según rol ────────────────────────────────
  const getVisibleFolders = () => {
    const projectFolders = folders.filter((f) => f.projectId === selectedProjectId);

    if (user.role === "usuario_externo" && user.assignments) {
      return projectFolders
        .map((folder) => {
          const assignment = user.assignments!.find((a) => a.folderId === folder.id);
          if (!assignment) return null;
          return {
            ...folder,
            forms: folder.forms.filter((form) => assignment.formIds.includes(form.id)),
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null && f.forms.length > 0);
    }

    return projectFolders;
  };

  const visibleFolders = getVisibleFolders();

  const filteredFolders = visibleFolders
    .map((folder) => ({
      ...folder,
      forms: folder.forms.filter((form) =>
        search.trim() === "" || form.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((folder) => folder.forms.length > 0 || search.trim() === "");

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const totalForms = visibleFolders.reduce((acc, f) => acc + f.forms.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', sans-serif", display: "flex" }}>

      {/* ── Sidebar oscuro estilo MoreApp ── */}
      <aside style={{
        width: 200, minHeight: "100vh", background: "#1e293b",
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "fixed", top: 0, bottom: 0, left: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <img src={logo} alt="Grupo Soul" style={{ height: 28, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {[
            { icon: "📋", label: "Formularios", active: true },
            { icon: "📝", label: "Borradores", active: false },
            { icon: "📤", label: "Enviados", active: false },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", borderRadius: 8, marginBottom: 2,
              background: item.active ? "rgba(0,194,168,0.15)" : "transparent",
              borderLeft: item.active ? "3px solid #00c2a8" : "3px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: item.active ? 700 : 400, color: item.active ? "#00c2a8" : "rgba(255,255,255,0.5)" }}>
                {item.label}
              </span>
            </div>
          ))}

          {/* Botón volver al admin (solo si es admin) */}
          {onSwitchToAdmin && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 8px" }} />
              <div onClick={onSwitchToAdmin} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px", borderRadius: 8,
                cursor: "pointer", transition: "all 0.15s",
                borderLeft: "3px solid transparent",
              }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 17 }}>⚙️</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Panel Admin</span>
              </div>
            </>
          )}
        </nav>

        {/* Footer usuario */}
        <div style={{ padding: "14px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #00c2a8, #0891b2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              {user.avatar}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "capitalize" }}>
                {user.role.replace("_", " ")}
              </div>
            </div>
          </div>
          <button onClick={onLogout} style={{
            width: "100%", padding: "7px 12px",
            background: "rgba(239,68,68,0.1)", color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7,
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, marginLeft: 200, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{
          background: "#ffffff", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Formularios</h1>
            {selectedProject && (
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                {selectedProject.name} · {totalForms} formulario{totalForms !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {projects.length > 1 && (
            <select value={selectedProjectId ?? ""} onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ padding: "6px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#374151", background: "#f8fafc", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          )}
        </header>

        {/* Buscador */}
        <div style={{ padding: "14px 24px", background: "#fff", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ position: "relative", maxWidth: 400 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8" }}>🔍</span>
            <input type="text" placeholder="Busca carpetas y formularios..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 36px", border: "1.5px solid #e2e8f0", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f8fafc", color: "#0f172a", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#00c2a8"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
            />
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

          {projects.length === 0 || totalForms === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#94a3b8" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>📋</span>
              <p style={{ fontSize: 15, fontWeight: 600 }}>No hay formularios disponibles</p>
              <p style={{ fontSize: 13 }}>
                {user.role === "usuario_externo"
                  ? "El administrador aún no te ha asignado formularios."
                  : "Contacta al administrador para asignarte formularios."}
              </p>
            </div>
          ) : (
            filteredFolders.map((folder) => {
              const isExpanded = expandedFolders.has(folder.id);
              return (
                <div key={folder.id} style={{ marginBottom: 8 }}>
                  {/* Carpeta */}
                  <div onClick={() => toggleFolder(folder.id)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", background: "#ffffff",
                    borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                    border: "1px solid #e2e8f0", cursor: "pointer", transition: "all 0.15s",
                    borderLeft: `4px solid ${folder.color}`,
                  }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{folder.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{folder.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{folder.forms.length} formulario{folder.forms.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 16, color: "#94a3b8", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                  </div>

                  {/* Formularios */}
                  {isExpanded && (
                    <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {folder.forms.map((form, index) => (
                        <div key={form.id} onClick={() => onFillForm(folder.id, form.id)} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "13px 18px", background: "#fff",
                          borderTop: index > 0 ? "1px solid #f1f5f9" : "none",
                          cursor: "pointer", transition: "all 0.12s",
                        }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: `${folder.color}18`,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                            }}>📋</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{form.name}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>Editado: {form.updatedAt}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 18, color: "#cbd5e1" }}>›</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {search.trim() !== "" && filteredFolders.every((f) => f.forms.length === 0) && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#94a3b8" }}>
              <span style={{ fontSize: 40 }}>🔍</span>
              <p style={{ fontSize: 14, marginTop: 12 }}>Sin resultados para "<strong>{search}</strong>"</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}