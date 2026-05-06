import { useState, useEffect } from "react";
import {
  getUsersApi, createUserApi, updateUserApi, deleteUserApi, toggleUserActiveApi,
  type UserApiData,
} from "../services/api";
import { ROLE_LABELS, ROLE_AVATARS, type UserRole } from "../types/auth.types";

const ROLES: UserRole[] = ["coordinator", "user"];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7c3aed",
  coordinator: "#0891b2",
  user: "#d97706",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserApiData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserApiData | null>(null);
  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("user");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsersApi();
    if (res.data) setUsers(res.data);
    else setErrorMsg(res.error ?? "Error al cargar usuarios");
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const filteredUsers = users.filter((u) =>
    search.trim() === "" ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenNew = () => {
    setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("user"); setFormError("");
    setShowNewUser(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }
    setSaving(true); setFormError("");
    const res = await createUserApi({ name: formName, email: formEmail, password: formPassword, role: formRole });
    setSaving(false);
    if (res.error) { setFormError(res.error); return; }
    setShowNewUser(false);
    loadUsers();
  };

  const handleOpenEdit = (user: UserApiData) => {
    setFormName(user.name); setFormEmail(user.email); setFormPassword(""); setFormRole(user.role as UserRole); setFormError("");
    setEditingUser(user);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!formName.trim() || !formEmail.trim()) { setFormError("Nombre y correo son obligatorios."); return; }
    setSaving(true); setFormError("");
    const dto: { name: string; email: string; role: string; password?: string } = { name: formName, email: formEmail, role: formRole };
    if (formPassword.trim()) dto.password = formPassword;
    const res = await updateUserApi(editingUser.id, dto);
    setSaving(false);
    if (res.error) { setFormError(res.error); return; }
    setEditingUser(null);
    loadUsers();
  };

  const handleToggleActive = async (user: UserApiData) => {
    await toggleUserActiveApi(user.id);
    loadUsers();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteUserApi(confirmDelete.id);
    setConfirmDelete(null);
    loadUsers();
  };

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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>👥 Gestión de Usuarios</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>{users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button style={btnPrimary} onClick={handleOpenNew}>➕ Nuevo usuario</button>
      </div>

      <div style={{ position: "relative", marginBottom: 20, maxWidth: 360 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
        <input type="text" placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af" }}>Cargando usuarios...</div>
      ) : errorMsg ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#dc2626" }}>{errorMsg}</div>
      ) : filteredUsers.length === 0 ? (
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
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)", opacity: user.isActive ? 1 : 0.6,
              flexWrap: "wrap",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: `${ROLE_COLORS[user.role as UserRole]}18`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                border: `2px solid ${ROLE_COLORS[user.role as UserRole]}33`,
              }}>
                {ROLE_AVATARS[user.role as UserRole]}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{user.name}</span>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: `${ROLE_COLORS[user.role as UserRole]}18`, color: ROLE_COLORS[user.role as UserRole],
                  }}>{ROLE_LABELS[user.role as UserRole]}</span>
                  {!user.isActive && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#9ca3af", fontWeight: 600 }}>Inactivo</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{user.email}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  Registrado: {new Date(user.createdAt).toLocaleDateString("es-CO")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <button onClick={() => handleOpenEdit(user)} style={{
                  padding: "6px 12px", background: "#f9fafb", color: "#374151",
                  border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>✏️ Editar</button>
                <button onClick={() => handleToggleActive(user)} style={{
                  padding: "6px 12px", background: user.isActive ? "#fffbeb" : "#f0fdf4",
                  color: user.isActive ? "#d97706" : "#15803d",
                  border: `1px solid ${user.isActive ? "#fde68a" : "#bbf7d0"}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{user.isActive ? "⏸ Desactivar" : "▶ Activar"}</button>
                <button onClick={() => setConfirmDelete(user)} style={{
                  padding: "6px 12px", background: "#fef2f2", color: "#dc2626",
                  border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      {showNewUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#111827" }}>Nuevo Usuario</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre completo</label>
            <input style={inputStyle} placeholder="Ej: Juan Pérez" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Correo electrónico</label>
            <input style={inputStyle} type="email" placeholder="usuario@empresa.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Contraseña</label>
            <input style={inputStyle} type="password" placeholder="Mínimo 6 caracteres" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Rol</label>
            <select value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {formError && <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 12px" }}>⚠️ {formError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setShowNewUser(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreate} disabled={saving}>{saving ? "Guardando..." : "Crear usuario"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#111827" }}>Editar Usuario</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nombre completo</label>
            <input style={inputStyle} value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Correo electrónico</label>
            <input style={inputStyle} type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Nueva contraseña <span style={{ fontWeight: 400, color: "#9ca3af" }}>(dejar vacío para no cambiar)</span></label>
            <input style={inputStyle} type="password" placeholder="••••••••" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Rol</label>
            <select value={formRole} onChange={(e) => setFormRole(e.target.value as UserRole)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {formError && <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 12px" }}>⚠️ {formError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setEditingUser(null)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleSaveEdit} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
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
              <button style={{ ...btnPrimary, background: "#ef4444" }} onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
