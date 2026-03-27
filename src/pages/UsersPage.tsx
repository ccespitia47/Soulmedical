import { useState } from "react";
import { useUsersStore, type AppUser, type UserAssignment } from "../store/useUsersStore";
import { useFolderStore } from "../store/useFolderStore";
import { ROLE_LABELS, ROLE_AVATARS, type UserRole } from "../types/auth.types";

const ROLES: UserRole[] = ["coordinator", "user"];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7c3aed",
  coordinator: "#0891b2",
  user: "#d97706",
};

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, toggleActive, updateAssignments } = useUsersStore();
  const { folders } = useFolderStore();

  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [assigningUser, setAssigningUser] = useState<AppUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [search, setSearch] = useState("");

  // Form estado
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("user");

  // Asignaciones temporales
  const [tempAssignments, setTempAssignments] = useState<UserAssignment[]>([]);

  const filteredUsers = users.filter((u) =>
    search.trim() === "" ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenNew = () => {
    setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("user");
    setShowNewUser(true);
  };

  const handleCreate = () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) return;
    addUser({ email: formEmail, name: formName, role: formRole, password: formPassword });
    setShowNewUser(false);
  };

  const handleOpenEdit = (user: AppUser) => {
    setFormName(user.name); setFormEmail(user.email);
    setFormPassword(user.password); setFormRole(user.role);
    setEditingUser(user);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, { name: formName, email: formEmail, password: formPassword, role: formRole });
    setEditingUser(null);
  };

  const handleOpenAssign = (user: AppUser) => {
    setTempAssignments(user.assignments ? [...user.assignments.map((a) => ({ ...a, formIds: [...a.formIds] }))] : []);
    setAssigningUser(user);
  };

  const handleSaveAssignments = () => {
    if (!assigningUser) return;
    updateAssignments(assigningUser.id, tempAssignments);
    setAssigningUser(null);
  };

  const toggleFormAssignment = (folderId: string, formId: string) => {
    setTempAssignments((prev) => {
      const folderIdx = prev.findIndex((a) => a.folderId === folderId);
      if (folderIdx === -1) {
        return [...prev, { folderId, formIds: [formId] }];
      }
      const updated = [...prev];
      const formIds = updated[folderIdx].formIds;
      if (formIds.includes(formId)) {
        updated[folderIdx] = { ...updated[folderIdx], formIds: formIds.filter((id) => id !== formId) };
        if (updated[folderIdx].formIds.length === 0) updated.splice(folderIdx, 1);
      } else {
        updated[folderIdx] = { ...updated[folderIdx], formIds: [...formIds, formId] };
      }
      return updated;
    });
  };

  const isFormAssigned = (folderId: string, formId: string) =>
    tempAssignments.some((a) => a.folderId === folderId && a.formIds.includes(formId));

  const getAssignmentCount = (user: AppUser) =>
    (user.assignments ?? []).reduce((acc, a) => acc + a.formIds.length, 0);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12, color: "#111827",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "9px 20px", background: "#00c2a8", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  const btnGhost: React.CSSProperties = {
    padding: "9px 20px", background: "none", color: "#6b7280", border: "1.5px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>👥 Gestión de Usuarios</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>{users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button style={btnPrimary} onClick={handleOpenNew}>➕ Nuevo usuario</button>
      </div>

      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: 20, maxWidth: 360 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
        <input type="text" placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
      </div>

      {/* Lista usuarios */}
      {filteredUsers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", border: "2px dashed #e2e8f0", borderRadius: 16, color: "#9ca3af" }}>
          <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>👥</span>
          <p style={{ fontSize: 15, fontWeight: 600 }}>No hay usuarios registrados</p>
          <p style={{ fontSize: 13 }}>Crea el primer usuario con el botón de arriba</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredUsers.map((user) => (
            <div key={user.id} style={{
              background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0",
              padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)", opacity: user.active ? 1 : 0.6,
              flexWrap: "wrap",
            }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: `${ROLE_COLORS[user.role]}18`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                border: `2px solid ${ROLE_COLORS[user.role]}33`,
              }}>
                {ROLE_AVATARS[user.role]}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{user.name}</span>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: `${ROLE_COLORS[user.role]}18`, color: ROLE_COLORS[user.role],
                  }}>{ROLE_LABELS[user.role]}</span>
                  {!user.active && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#9ca3af", fontWeight: 600 }}>Inactivo</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{user.email}</div>
                {user.role === "user" && (
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    {getAssignmentCount(user)} formulario{getAssignmentCount(user) !== 1 ? "s" : ""} asignado{getAssignmentCount(user) !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                {user.role === "user" && (
                  <button onClick={() => handleOpenAssign(user)} style={{
                    padding: "6px 12px", background: "#eff6ff", color: "#1d4ed8",
                    border: "1px solid #bfdbfe", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    📋 Asignar
                  </button>
                )}
                <button onClick={() => handleOpenEdit(user)} style={{
                  padding: "6px 12px", background: "#f9fafb", color: "#374151",
                  border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>✏️ Editar</button>
                <button onClick={() => toggleActive(user.id)} style={{
                  padding: "6px 12px", background: user.active ? "#fffbeb" : "#f0fdf4",
                  color: user.active ? "#d97706" : "#15803d",
                  border: `1px solid ${user.active ? "#fde68a" : "#bbf7d0"}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{user.active ? "⏸ Desactivar" : "▶ Activar"}</button>
                <button onClick={() => setConfirmDelete(user)} style={{
                  padding: "6px 12px", background: "#fef2f2", color: "#dc2626",
                  border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Nuevo Usuario ── */}
      {showNewUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#111827" }}>Nuevo Usuario</h2>

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre completo</label>
            <input style={inputStyle} placeholder="Ej: Juan Pérez" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Correo electrónico</label>
            <input style={inputStyle} type="email" placeholder="usuario@empresa.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Contraseña</label>
            <input style={inputStyle} type="password" placeholder="Mínimo 6 caracteres" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Rol</label>
            <select value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={btnGhost} onClick={() => setShowNewUser(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreate}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editar Usuario ── */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#111827" }}>Editar Usuario</h2>

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre completo</label>
            <input style={inputStyle} value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Correo electrónico</label>
            <input style={inputStyle} type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Contraseña</label>
            <input style={inputStyle} type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Rol</label>
            <select value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button style={btnGhost} onClick={() => setEditingUser(null)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleSaveEdit}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Asignar Formularios (solo usuario_externo) ── */}
      {assigningUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 540, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#111827" }}>
                Asignar Formularios
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                {assigningUser.name} · Selecciona los formularios a los que tendrá acceso
              </p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              {folders.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No hay carpetas disponibles</p>
              ) : (
                folders.map((folder) => (
                  <div key={folder.id} style={{ marginBottom: 16 }}>
                    {/* Carpeta */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 14px", background: "#f8fafc",
                      borderRadius: 8, marginBottom: 6,
                      borderLeft: `3px solid ${folder.color}`,
                    }}>
                      <span style={{ fontSize: 18 }}>{folder.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{folder.name}</span>
                    </div>

                    {/* Formularios */}
                    {folder.forms.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#9ca3af", padding: "4px 14px" }}>Sin formularios</p>
                    ) : (
                      folder.forms.map((form) => {
                        const assigned = isFormAssigned(folder.id, form.id);
                        return (
                          <div key={form.id}
                            onClick={() => toggleFormAssignment(folder.id, form.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "10px 14px", marginBottom: 4,
                              borderRadius: 8, cursor: "pointer",
                              background: assigned ? "#f0fdf4" : "#fff",
                              border: `1.5px solid ${assigned ? "#bbf7d0" : "#e2e8f0"}`,
                              transition: "all 0.15s",
                            }}
                          >
                            <div style={{
                              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${assigned ? "#00c2a8" : "#d1d5db"}`,
                              background: assigned ? "#00c2a8" : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {assigned && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 13, color: assigned ? "#065f46" : "#374151", fontWeight: assigned ? 600 : 400 }}>
                              📋 {form.name}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #e2e8f0", marginTop: 8 }}>
              <button style={btnGhost} onClick={() => setAssigningUser(null)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleSaveAssignments}>
                💾 Guardar asignaciones ({tempAssignments.reduce((a, b) => a + b.formIds.length, 0)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Eliminar ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 20px", background: "linear-gradient(135deg, #ef4444, #dc2626)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 32 }}>🗑️</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>¿Eliminar usuario?</h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>
              Se eliminará a <strong>{confirmDelete.name}</strong> permanentemente.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={btnGhost} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button style={{ ...btnPrimary, background: "#ef4444" }} onClick={() => { deleteUser(confirmDelete.id); setConfirmDelete(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}