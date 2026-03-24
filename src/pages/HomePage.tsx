import { useState } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";
import { FOLDER_COLORS, FOLDER_ICONS, PROJECT_COLORS, PROJECT_ICONS } from "../types/folder.types";
import logo from "../assets/Logo_GrupoSoul.png";

// ── ConfirmModal fuera del componente para evitar problemas de re-render ──
function ConfirmModal({
  title, message, onCancel, onConfirm, confirmLabel, confirmColor,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 20px", background: `linear-gradient(135deg, ${confirmColor}, ${confirmColor}cc)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 20px ${confirmColor}4d` }}>
          <span style={{ fontSize: 32 }}>{confirmColor === "#ef4444" ? "🗑️" : "📋"}</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: message }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ padding: "10px 24px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: "10px 24px", background: confirmColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: `0 2px 8px ${confirmColor}4d` }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──
export default function HomePage({
  onOpenBuilder,
  onLogout,
}: {
  onOpenBuilder: (folderId: string, formId: string) => void;
  onLogout: () => void;
}) {
  const { folders, addFolder, deleteFolder, updateFolder, addForm, deleteForm, selectFolder, selectedFolderId, duplicateFolder, duplicateForm } = useFolderStore();
  const { projects, selectedProjectId, addProject, deleteProject, updateProject, selectProject } = useProjectStore();

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<{ folderId: string; folderName: string } | null>(null);
  const [confirmDuplicateFolder, setConfirmDuplicateFolder] = useState<{ folderId: string; folderName: string } | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ projectId: string; projectName: string } | null>(null);

  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#00c2a8");
  const [folderIcon, setFolderIcon] = useState("📁");
  const [newFormName, setNewFormName] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#00c2a8");
  const [projectIcon, setProjectIcon] = useState("🏢");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectFolders = folders.filter((f) => f.projectId === selectedProjectId);
  const selectedFolder = projectFolders.find((f) => f.id === selectedFolderId);

  const handleCreateFolder = () => {
    if (!folderName.trim() || !selectedProjectId) return;
    addFolder(folderName.trim(), folderColor, folderIcon, selectedProjectId);
    setFolderName(""); setFolderColor("#00c2a8"); setFolderIcon("📁");
    setShowNewFolder(false);
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    addProject(projectName.trim(), projectColor, projectIcon);
    setProjectName(""); setProjectColor("#00c2a8"); setProjectIcon("🏢");
    setShowNewProject(false);
  };

  const handleOpenEditProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setProjectName(project.name); setProjectColor(project.color); setProjectIcon(project.icon);
    setEditingProjectId(projectId); setShowEditProject(true);
  };

  const handleSaveEditProject = () => {
    if (!editingProjectId || !projectName.trim()) return;
    updateProject(editingProjectId, { name: projectName, color: projectColor, icon: projectIcon });
    setShowEditProject(false); setEditingProjectId(null);
  };

  const handleConfirmDeleteProject = () => {
    if (!confirmDeleteProject) return;
    deleteProject(confirmDeleteProject.projectId);
    setConfirmDeleteProject(null);
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteForm(confirmDelete.folderId, confirmDelete.formId);
    setConfirmDelete(null);
  };

  const handleConfirmDuplicate = () => {
    if (!confirmDuplicate) return;
    duplicateForm(confirmDuplicate.folderId, confirmDuplicate.formId);
    setConfirmDuplicate(null);
  };

  const handleConfirmDeleteFolder = () => {
    if (!confirmDeleteFolder) return;
    deleteFolder(confirmDeleteFolder.folderId);
    setConfirmDeleteFolder(null);
  };

  const handleConfirmDuplicateFolder = () => {
    if (!confirmDuplicateFolder) return;
    duplicateFolder(confirmDuplicateFolder.folderId);
    setConfirmDuplicateFolder(null);
  };

  const handleSaveEditFolder = () => {
    if (!editingFolder || !folderName.trim()) return;
    updateFolder(editingFolder, { name: folderName, color: folderColor, icon: folderIcon });
    setShowEditFolder(false); setEditingFolder(null);
  };

  const handleOpenEdit = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setFolderName(folder.name); setFolderColor(folder.color); setFolderIcon(folder.icon);
    setEditingFolder(folderId); setShowEditFolder(true);
  };

  const handleCreateForm = () => {
    if (!newFormName.trim() || !selectedFolderId) return;
    addForm(selectedFolderId, newFormName.trim());
    setNewFormName(""); setShowNewForm(false);
  };

  const handleSelectProject = (id: string) => {
    selectProject(id); selectFolder(null); setSidebarOpen(false);
  };

  // ── Estilos reutilizables ──
  const cardStyle = (color: string) => ({
    background: "#ffffff", borderRadius: 12, border: `2px solid ${color}22`,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
  });

  const inputStyle = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 12,
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 20px", background: "#00c2a8", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  const btnGhost: React.CSSProperties = {
    padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0",
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  const colorBtns = (selected: string, setColor: (v: string) => void, colors: typeof FOLDER_COLORS) => (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {colors.map((c) => (
        <button key={c.id} onClick={() => setColor(c.value)} title={c.label}
          style={{ width: 32, height: 32, borderRadius: "50%", background: c.value, border: selected === c.value ? "3px solid #111827" : "3px solid transparent", cursor: "pointer" }} />
      ))}
    </div>
  );

  const iconBtns = (selected: string, setIcon: (v: string) => void, icons: typeof FOLDER_ICONS) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {icons.map((ic) => (
        <button key={ic.id} onClick={() => setIcon(ic.id)} title={ic.label}
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 20, border: selected === ic.id ? "2px solid #00c2a8" : "2px solid #e2e8f0", background: selected === ic.id ? "#e6faf7" : "#fff", cursor: "pointer" }}>
          {ic.id}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif", display: "flex" }}>

      {/* ── Sidebar ── */}
      <aside className="sidebar-desktop" style={{
        width: 260, minHeight: "100vh", background: "#ffffff", borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "fixed", left: sidebarOpen ? 0 : undefined, top: 0, bottom: 0, zIndex: 50, transition: "transform 0.3s",
      }}>
        {/* Logo */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="Grupo Soul" style={{ height: 32, objectFit: "contain" }} />
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Formularios</span>
        </div>

        {/* Nuevo Proyecto */}
        <div style={{ padding: "14px 14px 8px" }}>
          <button onClick={() => setShowNewProject(true)} style={{
            width: "100%", padding: "10px 14px", background: "linear-gradient(135deg, #00c2a8, #00a892)",
            color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            boxShadow: "0 2px 8px rgba(0,194,168,0.3)",
          }}>
            ➕ Nuevo Proyecto
          </button>
        </div>

        {/* Lista proyectos */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase", padding: "8px 8px 6px" }}>
            PROYECTOS ({projects.length})
          </div>

          {projects.length === 0 && (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "#9ca3af" }}>
              <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🏢</span>
              <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>Crea tu primer proyecto para organizar tus formularios</p>
            </div>
          )}

          {projects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            return (
              <div key={project.id} onClick={() => handleSelectProject(project.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 8,
                cursor: "pointer", transition: "all 0.15s", marginBottom: 2,
                background: isSelected ? `${project.color}15` : "transparent",
                borderLeft: isSelected ? `3px solid ${project.color}` : "3px solid transparent",
              }}
                onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{project.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? project.color : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {project.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>
                    {folders.filter((f) => f.projectId === project.id).length} carpetas
                  </div>
                </div>
                {isSelected && (
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenEditProject(project.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 2, color: "#9ca3af" }} title="Editar">✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteProject({ projectId: project.id, projectName: project.name }); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 2, color: "#9ca3af" }} title="Eliminar">🗑️</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer sidebar con cerrar sesión */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%", padding: "9px 14px", background: "none", color: "#ef4444",
              border: "1.5px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#fecaca"; }}
          >
            🚪 Cerrar sesión
          </button>
          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>SoulForms v1.0</div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <main className="main-content" style={{ flex: 1, marginLeft: 260, minHeight: "100vh" }}>

        {/* Topbar mobile */}
        <header className="mobile-topbar" style={{
          background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 16px",
          minHeight: 56, display: "none", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "4px 8px" }}>☰</button>
          <img src={logo} alt="Grupo Soul" style={{ height: 28, objectFit: "contain" }} />
          <div style={{ width: 36 }} />
        </header>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

          {/* Sin proyecto */}
          {!selectedProjectId && (
            <div style={{ textAlign: "center", padding: "100px 24px", color: "#9ca3af" }}>
              <span style={{ fontSize: 56, display: "block", marginBottom: 16 }}>🏢</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Selecciona o crea un proyecto</h2>
              <p style={{ fontSize: 14, margin: "0 auto 24px", maxWidth: 400 }}>
                Los proyectos te permiten agrupar carpetas y formularios.
              </p>
              <button style={btnPrimary} onClick={() => setShowNewProject(true)}>➕ Crear primer proyecto</button>
            </div>
          )}

          {/* Vista carpetas */}
          {selectedProject && !selectedFolderId && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{selectedProject.icon}</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>{selectedProject.name}</h1>
                  </div>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0 38px" }}>Organiza tus formularios en carpetas</p>
                </div>
                <button style={btnPrimary} onClick={() => setShowNewFolder(true)}>➕ Nueva carpeta</button>
              </div>

              {projectFolders.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 24px", border: "2px dashed #e2e8f0", borderRadius: 16, color: "#9ca3af" }}>
                  <span style={{ fontSize: 48 }}>📁</span>
                  <p style={{ fontSize: 16, marginTop: 16, marginBottom: 8, fontWeight: 600 }}>No hay carpetas todavía</p>
                  <p style={{ fontSize: 14, marginBottom: 20 }}>Crea tu primera carpeta</p>
                  <button style={btnPrimary} onClick={() => setShowNewFolder(true)}>Crear carpeta</button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {projectFolders.map((folder) => (
                  <div key={folder.id} style={cardStyle(folder.color)}
                    onClick={() => selectFolder(folder.id)}
                    onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
                  >
                    <div style={{ height: 6, background: folder.color }} />
                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: 32 }}>{folder.icon}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(folder.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", borderRadius: 4, color: "#9ca3af" }}>✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDuplicateFolder({ folderId: folder.id, folderName: folder.name }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", borderRadius: 4, color: "#9ca3af" }}>📋</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteFolder({ folderId: folder.id, folderName: folder.name }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", borderRadius: 4, color: "#9ca3af" }}>🗑️</button>
                        </div>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{folder.name}</h3>
                      <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>{folder.forms.length} formulario{folder.forms.length !== 1 ? "s" : ""}</p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Creada: {folder.createdAt}</span>
                        <span style={{ fontSize: 12, color: folder.color, fontWeight: 600 }}>Ver →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Vista formularios */}
          {selectedFolder && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                <button onClick={() => selectFolder(null)} style={{ ...btnGhost, padding: "8px 14px", fontSize: 13 }}>← Volver</button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{selectedFolder.icon}</span>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{selectedFolder.name}</h1>
                  </div>
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: "2px 0 0 32px" }}>
                    {selectedFolder.forms.length} formulario{selectedFolder.forms.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button style={btnPrimary} onClick={() => setShowNewForm(true)}>➕ Nuevo formulario</button>
              </div>

              {selectedFolder.forms.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 24px", border: "2px dashed #e2e8f0", borderRadius: 16, color: "#9ca3af" }}>
                  <span style={{ fontSize: 40 }}>📋</span>
                  <p style={{ fontSize: 15, marginTop: 12, marginBottom: 8, fontWeight: 600 }}>No hay formularios en esta carpeta</p>
                  <p style={{ fontSize: 13, marginBottom: 20 }}>Crea tu primer formulario</p>
                  <button style={btnPrimary} onClick={() => setShowNewForm(true)}>Crear formulario</button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {selectedFolder.forms.map((form) => (
                  <div key={form.id}
                    style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e2e8f0", padding: 16, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = selectedFolder.color; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
                    onClick={() => onOpenBuilder(selectedFolder.id, form.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 28 }}>📋</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDuplicate({ folderId: selectedFolder.id, formId: form.id, formName: form.name }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>📋</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ folderId: selectedFolder.id, formId: form.id, formName: form.name }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>🗑️</button>
                      </div>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{form.name}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Editado: {form.updatedAt}</p>
                    <div style={{ marginTop: 12, padding: "6px 10px", background: selectedFolder.color + "18", borderRadius: 6, textAlign: "center", fontSize: 12, fontWeight: 600, color: selectedFolder.color }}>
                      Abrir editor →
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Modales de creación/edición ── */}

      {/* Nuevo Proyecto */}
      {showNewProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Nuevo Proyecto</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} placeholder="Ej: Contabilidad" value={projectName} onChange={(e) => setProjectName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Color</label>
            {colorBtns(projectColor, setProjectColor, PROJECT_COLORS)}
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Icono</label>
            {iconBtns(projectIcon, setProjectIcon, PROJECT_ICONS)}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowNewProject(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreateProject}>Crear proyecto</button>
            </div>
          </div>
        </div>
      )}

      {/* Editar Proyecto */}
      {showEditProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Editar Proyecto</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} value={projectName} onChange={(e) => setProjectName(e.target.value)} autoFocus />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Color</label>
            {colorBtns(projectColor, setProjectColor, PROJECT_COLORS)}
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Icono</label>
            {iconBtns(projectIcon, setProjectIcon, PROJECT_ICONS)}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowEditProject(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleSaveEditProject}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Nueva Carpeta */}
      {showNewFolder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Nueva Carpeta</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} placeholder="Ej: Formularios de salud" value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Color</label>
            {colorBtns(folderColor, setFolderColor, FOLDER_COLORS)}
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Icono</label>
            {iconBtns(folderIcon, setFolderIcon, FOLDER_ICONS)}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowNewFolder(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreateFolder}>Crear carpeta</button>
            </div>
          </div>
        </div>
      )}

      {/* Editar Carpeta */}
      {showEditFolder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Editar Carpeta</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Color</label>
            {colorBtns(folderColor, setFolderColor, FOLDER_COLORS)}
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Icono</label>
            {iconBtns(folderIcon, setFolderIcon, FOLDER_ICONS)}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowEditFolder(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleSaveEditFolder}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Nuevo Formulario */}
      {showNewForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Nuevo Formulario</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre del formulario</label>
            <input style={inputStyle} placeholder="Ej: Registro de pacientes" value={newFormName} onChange={(e) => setNewFormName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateForm(); }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowNewForm(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreateForm}>Crear formulario</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modales de confirmación ── */}
      {confirmDelete && (
        <ConfirmModal title="¿Eliminar formulario?"
          message={`Estás a punto de eliminar "<strong>${confirmDelete.formName}</strong>". Esta acción no se puede deshacer.`}
          onCancel={() => setConfirmDelete(null)} onConfirm={handleConfirmDelete}
          confirmLabel="Eliminar" confirmColor="#ef4444" />
      )}
      {confirmDuplicate && (
        <ConfirmModal title="¿Duplicar formulario?"
          message={`Se creará una copia de "<strong>${confirmDuplicate.formName}</strong>" con todos sus campos.`}
          onCancel={() => setConfirmDuplicate(null)} onConfirm={handleConfirmDuplicate}
          confirmLabel="Duplicar" confirmColor="#3b82f6" />
      )}
      {confirmDeleteFolder && (
        <ConfirmModal title="¿Eliminar carpeta?"
          message={`Estás a punto de eliminar la carpeta "<strong>${confirmDeleteFolder.folderName}</strong>" y todos sus formularios.`}
          onCancel={() => setConfirmDeleteFolder(null)} onConfirm={handleConfirmDeleteFolder}
          confirmLabel="Eliminar" confirmColor="#ef4444" />
      )}
      {confirmDuplicateFolder && (
        <ConfirmModal title="¿Duplicar carpeta?"
          message={`Se creará una copia de la carpeta "<strong>${confirmDuplicateFolder.folderName}</strong>" con todos sus formularios.`}
          onCancel={() => setConfirmDuplicateFolder(null)} onConfirm={handleConfirmDuplicateFolder}
          confirmLabel="Duplicar" confirmColor="#3b82f6" />
      )}
      {confirmDeleteProject && (
        <ConfirmModal title="¿Eliminar proyecto?"
          message={`Estás a punto de eliminar el proyecto "<strong>${confirmDeleteProject.projectName}</strong>" y todas sus carpetas y formularios.`}
          onCancel={() => setConfirmDeleteProject(null)} onConfirm={handleConfirmDeleteProject}
          confirmLabel="Eliminar" confirmColor="#ef4444" />
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { transform: translateX(-100%); }
          .sidebar-desktop[style*="left: 0"] { transform: translateX(0) !important; }
          .main-content { margin-left: 0 !important; }
          .mobile-topbar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sidebar-overlay { display: none !important; }
        }
      `}</style>
    </div>
  );
}