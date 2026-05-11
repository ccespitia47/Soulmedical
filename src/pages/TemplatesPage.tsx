import { useState } from "react";
import { useTemplatesStore } from "../store/useTemplatesStore";
import { useFolderStore } from "../store/useFolderStore";
import type { AuthUser } from "../types/auth.types";
import type { TemplateItem } from "../types/folder.types";
import { FOLDER_COLORS, FOLDER_ICONS } from "../types/folder.types";

type TemplatesPageProps = {
  onUseTemplate: (widgets: TemplateItem["widgets"], folderId: string, formId: string) => void;
  currentUser: Pick<AuthUser, "name" | "role" | "avatar">;
};

// ── Modal crear carpeta ───────────────────────────────────────────────────────
function CreateFolderModal({ onSave, onClose }: {
  onSave: (name: string, color: string, icon: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0].value);
  const [icon, setIcon] = useState(FOLDER_ICONS[0].id);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 20px" }}>📁 Nueva carpeta de plantillas</h2>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Formularios clínicos"
          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} autoFocus />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Color</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {FOLDER_COLORS.map(c => (
            <button key={c.id} onClick={() => setColor(c.value)} style={{
              width: 28, height: 28, borderRadius: "50%", background: c.value,
              border: color === c.value ? "3px solid #111827" : "2px solid transparent", cursor: "pointer",
            }} />
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 8, textTransform: "uppercase" }}>Ícono</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {FOLDER_ICONS.map(ic => (
            <button key={ic.id} onClick={() => setIcon(ic.id)} style={{
              width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: "pointer",
              border: icon === ic.id ? "2px solid #00c2a8" : "2px solid #e2e8f0",
              background: icon === ic.id ? "#e6faf7" : "#fff",
            }}>{ic.id}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => name.trim() && onSave(name.trim(), color, icon)} disabled={!name.trim()}
            style={{ padding: "10px 20px", background: name.trim() ? "#00c2a8" : "#e2e8f0", color: name.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed" }}>
            Crear carpeta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal usar plantilla ──────────────────────────────────────────────────────
function UseTemplateModal({ template, onUse, onClose }: {
  template: TemplateItem;
  onUse: (folderId: string, formId: string) => void;
  onClose: () => void;
}) {
  const { folders, addForm, saveFormWidgets } = useFolderStore();
  const [selectedFolderId, setSelectedFolderId] = useState(folders[0]?.id ?? "");
  const [formName, setFormName] = useState(template.name);

  const handleUse = () => {
    if (!selectedFolderId || !formName.trim()) return;
    addForm(selectedFolderId, formName.trim());
    setTimeout(() => {
      const updatedFolder = useFolderStore.getState().folders.find(f => f.id === selectedFolderId);
      const createdForm = updatedFolder?.forms[updatedFolder.forms.length - 1];
      if (createdForm) {
        saveFormWidgets(selectedFolderId, createdForm.id, template.widgets);
        onUse(selectedFolderId, createdForm.id);
      }
    }, 100);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{template.icon} Usar plantilla</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
          Se creará un nuevo formulario basado en <strong>{template.name}</strong>
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre del formulario *</label>
        <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre del formulario"
          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} autoFocus />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Guardar en carpeta *</label>
        {folders.length === 0 ? (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
            ⚠️ No hay carpetas disponibles. Crea una carpeta primero en Formularios.
          </div>
        ) : (
          <select value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 16 }}>
            {folders.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
          </select>
        )}

        <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534", marginBottom: 20 }}>
          ✅ Se copiarán <strong>{template.widgets.length} campo{template.widgets.length !== 1 ? "s" : ""}</strong> de la plantilla
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleUse} disabled={!formName.trim() || !selectedFolderId}
            style={{ padding: "10px 20px", background: !formName.trim() || !selectedFolderId ? "#e2e8f0" : "#00c2a8", color: !formName.trim() || !selectedFolderId ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !formName.trim() || !selectedFolderId ? "not-allowed" : "pointer" }}>
            ✅ Crear formulario
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TemplatesPage ─────────────────────────────────────────────────────────────
export default function TemplatesPage({ onUseTemplate }: TemplatesPageProps) {
  const { templates, templateFolders, addTemplateFolder, deleteTemplateFolder, deleteTemplate } = useTemplatesStore();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [useTemplate, setUseTemplate] = useState<TemplateItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "folder" | "template"; id: string; name: string } | null>(null);

  const filteredTemplates = selectedFolderId
    ? templates.filter(t => t.folderId === selectedFolderId)
    : templates;

  return (
    <div style={{ padding: "32px 32px 40px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0 }}>📑 Plantillas</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            Reutiliza formularios guardados como plantilla en cualquier proyecto
          </p>
        </div>
        <button onClick={() => setShowCreateFolder(true)} style={{
          padding: "10px 18px", background: "#00c2a8", color: "#fff",
          border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,194,168,0.3)",
        }}>
          + Nueva carpeta
        </button>
      </div>

      {templateFolders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "#fff", borderRadius: 16, border: "2px dashed #e2e8f0" }}>
          <span style={{ fontSize: 64, display: "block", marginBottom: 16 }}>📑</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>No hay carpetas de plantillas</h2>
          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 24px", lineHeight: 1.6 }}>
            Crea una carpeta para organizar tus plantillas.<br />
            Luego guarda formularios como plantillas desde el Builder.
          </p>
          <button onClick={() => setShowCreateFolder(true)} style={{
            padding: "12px 24px", background: "#00c2a8", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            + Crear primera carpeta
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* Carpetas */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Carpetas
              </div>

              <div onClick={() => setSelectedFolderId(null)} style={{
                padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                background: selectedFolderId === null ? "#e6faf7" : "transparent",
                borderLeft: selectedFolderId === null ? "3px solid #00c2a8" : "3px solid transparent",
              }}>
                <span>📋</span>
                <span style={{ fontSize: 13, fontWeight: selectedFolderId === null ? 700 : 500, color: selectedFolderId === null ? "#00c2a8" : "#374151" }}>
                  Todas ({templates.length})
                </span>
              </div>

              {templateFolders.map((folder) => {
                const count = templates.filter(t => t.folderId === folder.id).length;
                const isActive = selectedFolderId === folder.id;
                return (
                  <div key={folder.id} onClick={() => setSelectedFolderId(folder.id)} style={{
                    padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 8,
                    background: isActive ? "#e6faf7" : "transparent",
                    borderLeft: `3px solid ${isActive ? folder.color : "transparent"}`,
                  }}
                    onMouseOver={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseOut={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 16 }}>{folder.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? folder.color : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {folder.name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{count}</span>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "folder", id: folder.id, name: folder.name }); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13, padding: "1px 3px", borderRadius: 4 }}
                        onMouseOver={e => { e.currentTarget.style.color = "#ef4444"; }}
                        onMouseOut={e => { e.currentTarget.style.color = "#9ca3af"; }}
                      >🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plantillas */}
          <div style={{ flex: 1 }}>
            {filteredTemplates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 12, border: "2px dashed #e2e8f0" }}>
                <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>📑</span>
                <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
                  {selectedFolderId ? "Esta carpeta no tiene plantillas aún" : "No hay plantillas guardadas"}
                </p>
                <p style={{ fontSize: 12, color: "#c4c9d4", margin: "8px 0 0" }}>
                  Ve al Builder y usa el botón "📑 Plantilla" para guardar un formulario
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {filteredTemplates.map((template) => {
                  const folder = templateFolders.find(f => f.id === template.folderId);
                  return (
                    <div key={template.id} style={{
                      background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
                      padding: "18px 18px 14px", display: "flex", flexDirection: "column",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s",
                    }}
                      onMouseOver={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
                      onMouseOut={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: "linear-gradient(135deg, #e6faf7, #e0f2fe)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                          }}>
                            {template.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{template.name}</div>
                            {folder && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{folder.icon} {folder.name}</div>}
                          </div>
                        </div>
                        <button onClick={() => setConfirmDelete({ type: "template", id: template.id, name: template.name })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: "2px 4px", borderRadius: 4 }}
                          onMouseOver={e => { e.currentTarget.style.color = "#ef4444"; }}
                          onMouseOut={e => { e.currentTarget.style.color = "#9ca3af"; }}
                        >🗑️</button>
                      </div>

                      {template.description && (
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>{template.description}</p>
                      )}

                      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f0fdf4", color: "#15803d", fontWeight: 600 }}>
                          {template.widgets.length} campo{template.widgets.length !== 1 ? "s" : ""}
                        </span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>por {template.createdBy}</span>
                      </div>

                      <button onClick={() => setUseTemplate(template)} style={{
                        width: "100%", padding: "9px", background: "#00c2a8", color: "#fff",
                        border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", marginTop: "auto", boxShadow: "0 2px 6px rgba(0,194,168,0.25)",
                      }}>
                        ✅ Usar plantilla
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {showCreateFolder && (
        <CreateFolderModal
          onSave={(name, color, icon) => { addTemplateFolder(name, color, icon); setShowCreateFolder(false); }}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {useTemplate && (
        <UseTemplateModal
          template={useTemplate}
          onUse={(folderId, formId) => { setUseTemplate(null); onUseTemplate(useTemplate.widgets, folderId, formId); }}
          onClose={() => setUseTemplate(null)}
        />
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>🗑️</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>
              ¿Eliminar {confirmDelete.type === "folder" ? "carpeta" : "plantilla"}?
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6 }}>
              <strong>"{confirmDelete.name}"</strong> será eliminada permanentemente.
              {confirmDelete.type === "folder" && " Las plantillas dentro quedarán sin carpeta."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "10px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => {
                if (confirmDelete.type === "folder") deleteTemplateFolder(confirmDelete.id);
                else deleteTemplate(confirmDelete.id);
                setConfirmDelete(null);
              }} style={{ padding: "10px 20px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}