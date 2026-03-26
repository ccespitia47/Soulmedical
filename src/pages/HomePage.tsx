import { useState } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";
import { FOLDER_COLORS, FOLDER_ICONS, PROJECT_COLORS, PROJECT_ICONS } from "../types/folder.types";

function ConfirmModal({ title, message, onCancel, onConfirm, confirmLabel, confirmColor }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void; confirmLabel: string; confirmColor: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 20px", background: `linear-gradient(135deg, ${confirmColor}, ${confirmColor}cc)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 32 }}>{confirmColor === "#ef4444" ? "🗑️" : "📋"}</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: message }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ padding: "10px 24px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: "10px 24px", background: confirmColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage({
  onOpenBuilder,
  onOpenForm,
  currentUser,
}: {
  onOpenBuilder: (folderId: string, formId: string) => void;
  onOpenForm: (folderId: string, formId: string) => void;
  currentUser?: { name: string; role: string; avatar: string } | null;
}) {
  const { folders, addFolder, deleteFolder, updateFolder, addForm, deleteForm, renameForm, selectFolder, selectedFolderId, duplicateFolder, duplicateForm } = useFolderStore();
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
  const [editingForm, setEditingForm] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [editFormName, setEditFormName] = useState("");
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
  const [search, setSearch] = useState("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectFolders = folders.filter((f) => f.projectId === selectedProjectId);
  const selectedFolder = projectFolders.find((f) => f.id === selectedFolderId);

  const handleCreateFolder = () => {
    if (!folderName.trim() || !selectedProjectId) return;
    addFolder(folderName.trim(), folderColor, folderIcon, selectedProjectId);
    setFolderName(""); setFolderColor("#00c2a8"); setFolderIcon("📁"); setShowNewFolder(false);
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    addProject(projectName.trim(), projectColor, projectIcon);
    setProjectName(""); setProjectColor("#00c2a8"); setProjectIcon("🏢"); setShowNewProject(false);
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

  const handleOpenEdit = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setFolderName(folder.name); setFolderColor(folder.color); setFolderIcon(folder.icon);
    setEditingFolder(folderId); setShowEditFolder(true);
  };

  const handleSaveEditFolder = () => {
    if (!editingFolder || !folderName.trim()) return;
    updateFolder(editingFolder, { name: folderName, color: folderColor, icon: folderIcon });
    setShowEditFolder(false); setEditingFolder(null);
  };

  const handleCreateForm = () => {
    if (!newFormName.trim() || !selectedFolderId) return;
    addForm(selectedFolderId, newFormName.trim());
    setNewFormName(""); setShowNewForm(false);
  };

  const filteredProjects = projects.filter((p) =>
    search.trim() === "" || p.name.toLowerCase().includes(search.toLowerCase())
  );

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
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Topbar */}
      <header style={{
        background: "#ffffff", borderBottom: "1px solid #e2e8f0",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0, whiteSpace: "nowrap" }}>Formularios</h1>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>🔍</span>
          <input type="text" placeholder="Buscar proyectos y carpetas..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 34px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f8fafc", color: "#111827", boxSizing: "border-box", transition: "all 0.2s" }}
            onFocus={(e) => { e.target.style.borderColor = "#00c2a8"; e.target.style.background = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 12 }}>
          {currentUser && (
            <>
              <span style={{ fontSize: 16 }}>{currentUser.avatar}</span>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{currentUser.name}</span>
            </>
          )}
        </div>
        <button style={{ ...btnPrimary, padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap" }} onClick={() => setShowNewProject(true)}>
          ➕ Nuevo Proyecto
        </button>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Lista de proyectos */}
        {!selectedProjectId && (
          <>
            {filteredProjects.length === 0 && search.trim() === "" ? (
              <div style={{ textAlign: "center", padding: "80px 24px", color: "#9ca3af" }}>
                <span style={{ fontSize: 56, display: "block", marginBottom: 16 }}>🏢</span>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Crea tu primer proyecto</h2>
                <p style={{ fontSize: 14, margin: "0 auto 24px", maxWidth: 400 }}>Organiza tus formularios en proyectos y carpetas.</p>
                <button style={btnPrimary} onClick={() => setShowNewProject(true)}>➕ Crear primer proyecto</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>PROYECTOS ({filteredProjects.length})</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                  {filteredProjects.map((project) => (
                    <div key={project.id} onClick={() => selectProject(project.id)} style={{
                      background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0",
                      padding: 18, cursor: "pointer", transition: "all 0.2s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: `4px solid ${project.color}`,
                    }}
                      onMouseOver={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 28 }}>{project.icon}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEditProject(project.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 2, color: "#9ca3af" }}>✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteProject({ projectId: project.id, projectName: project.name }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 2, color: "#9ca3af" }}>🗑️</button>
                        </div>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{project.name}</h3>
                      <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{folders.filter((f) => f.projectId === project.id).length} carpeta{folders.filter((f) => f.projectId === project.id).length !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
                {filteredProjects.length === 0 && search.trim() !== "" && (
                  <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af" }}>
                    <span style={{ fontSize: 40 }}>🔍</span>
                    <p style={{ fontSize: 14, marginTop: 12 }}>Sin resultados para "<strong>{search}</strong>"</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Vista carpetas */}
        {selectedProject && !selectedFolderId && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => selectProject("")} style={{ ...btnGhost, padding: "7px 12px", fontSize: 13 }}>← Proyectos</button>
                <span style={{ fontSize: 22 }}>{selectedProject.icon}</span>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{selectedProject.name}</h1>
              </div>
              <button style={btnPrimary} onClick={() => setShowNewFolder(true)}>➕ Nueva carpeta</button>
            </div>

            {projectFolders.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 24px", border: "2px dashed #e2e8f0", borderRadius: 16, color: "#9ca3af" }}>
                <span style={{ fontSize: 48 }}>📁</span>
                <p style={{ fontSize: 16, marginTop: 16, marginBottom: 8, fontWeight: 600 }}>No hay carpetas todavía</p>
                <button style={{ ...btnPrimary, marginTop: 12 }} onClick={() => setShowNewFolder(true)}>Crear carpeta</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {projectFolders.map((folder) => (
                <div key={folder.id} style={{ background: "#ffffff", borderRadius: 12, border: `2px solid ${folder.color}22`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden", transition: "all 0.2s" }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
                >
                  <div style={{ height: 6, background: folder.color }} />
                  <div style={{ padding: "16px", cursor: "pointer" }} onClick={() => selectFolder(folder.id)}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 32 }}>{folder.icon}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(folder.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", color: "#9ca3af" }}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDuplicateFolder({ folderId: folder.id, folderName: folder.name }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", color: "#9ca3af" }}>📋</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteFolder({ folderId: folder.id, folderName: folder.name }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px", color: "#9ca3af" }}>🗑️</button>
                      </div>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{folder.name}</h3>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 14px" }}>{folder.forms.length} formulario{folder.forms.length !== 1 ? "s" : ""}</p>
                    <button onClick={(e) => { e.stopPropagation(); selectFolder(folder.id); }}
                      style={{ width: "100%", padding: "7px 0", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      📂 Abrir
                    </button>
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
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "2px 0 0 32px" }}>{selectedFolder.forms.length} formulario{selectedFolder.forms.length !== 1 ? "s" : ""}</p>
              </div>
              <button style={btnPrimary} onClick={() => setShowNewForm(true)}>➕ Nuevo formulario</button>
            </div>

            {selectedFolder.forms.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px", border: "2px dashed #e2e8f0", borderRadius: 16, color: "#9ca3af" }}>
                <span style={{ fontSize: 40 }}>📋</span>
                <p style={{ fontSize: 15, marginTop: 12, marginBottom: 8, fontWeight: 600 }}>No hay formularios</p>
                <button style={{ ...btnPrimary, marginTop: 8 }} onClick={() => setShowNewForm(true)}>Crear formulario</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {selectedFolder.forms.map((form) => (
                <div key={form.id} style={{ background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.2s" }}
                  onMouseOver={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.borderColor = selectedFolder.color; }}
                  onMouseOut={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                >
                  <div style={{ height: 4, background: selectedFolder.color }} />
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 28 }}>📋</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditFormName(form.name); setEditingForm({ folderId: selectedFolder.id, formId: form.id, formName: form.name }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>✏️</button>
                        <button onClick={() => setConfirmDuplicate({ folderId: selectedFolder.id, formId: form.id, formName: form.name })} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>📋</button>
                        <button onClick={() => setConfirmDelete({ folderId: selectedFolder.id, formId: form.id, formName: form.name })} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>🗑️</button>
                      </div>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{form.name}</h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px" }}>Editado: {form.updatedAt}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onOpenForm(selectedFolder.id, form.id)}
                        style={{ flex: 1, padding: "8px 0", background: selectedFolder.color, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 2px 6px ${selectedFolder.color}44` }}>
                        ✏️ Diligenciar
                      </button>
                      <button onClick={() => onOpenBuilder(selectedFolder.id, form.id)}
                        style={{ flex: 1, padding: "8px 0", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        ⚙️ configuracion
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modales */}
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
      {showNewForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Nuevo Formulario</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} placeholder="Ej: Registro de pacientes" value={newFormName} onChange={(e) => setNewFormName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleCreateForm(); }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowNewForm(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreateForm}>Crear formulario</button>
            </div>
          </div>
        </div>
      )}

      {editingForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Editar Formulario</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre</label>
            <input style={inputStyle} value={editFormName} onChange={(e) => setEditFormName(e.target.value)} autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editFormName.trim()) { renameForm(editingForm.folderId, editingForm.formId, editFormName.trim()); }
                  setEditingForm(null);
                }
              }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setEditingForm(null)}>Cancelar</button>
              <button style={btnPrimary} onClick={() => {
                if (editFormName.trim()) { renameForm(editingForm.folderId, editingForm.formId, editFormName.trim()); }
                setEditingForm(null);
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && <ConfirmModal title="¿Eliminar formulario?" message={`Eliminarás "<strong>${confirmDelete.formName}</strong>".`} onCancel={() => setConfirmDelete(null)} onConfirm={() => { deleteForm(confirmDelete.folderId, confirmDelete.formId); setConfirmDelete(null); }} confirmLabel="Eliminar" confirmColor="#ef4444" />}
      {confirmDuplicate && <ConfirmModal title="¿Duplicar formulario?" message={`Se creará una copia de "<strong>${confirmDuplicate.formName}</strong>".`} onCancel={() => setConfirmDuplicate(null)} onConfirm={() => { duplicateForm(confirmDuplicate.folderId, confirmDuplicate.formId); setConfirmDuplicate(null); }} confirmLabel="Duplicar" confirmColor="#3b82f6" />}
      {confirmDeleteFolder && <ConfirmModal title="¿Eliminar carpeta?" message={`Eliminarás "<strong>${confirmDeleteFolder.folderName}</strong>" y todos sus formularios.`} onCancel={() => setConfirmDeleteFolder(null)} onConfirm={() => { deleteFolder(confirmDeleteFolder.folderId); setConfirmDeleteFolder(null); }} confirmLabel="Eliminar" confirmColor="#ef4444" />}
      {confirmDuplicateFolder && <ConfirmModal title="¿Duplicar carpeta?" message={`Se duplicará "<strong>${confirmDuplicateFolder.folderName}</strong>".`} onCancel={() => setConfirmDuplicateFolder(null)} onConfirm={() => { duplicateFolder(confirmDuplicateFolder.folderId); setConfirmDuplicateFolder(null); }} confirmLabel="Duplicar" confirmColor="#3b82f6" />}
      {confirmDeleteProject && <ConfirmModal title="¿Eliminar proyecto?" message={`Eliminarás "<strong>${confirmDeleteProject.projectName}</strong>" y todo su contenido.`} onCancel={() => setConfirmDeleteProject(null)} onConfirm={() => { deleteProject(confirmDeleteProject.projectId); setConfirmDeleteProject(null); }} confirmLabel="Eliminar" confirmColor="#ef4444" />}
    </div>
  );
}