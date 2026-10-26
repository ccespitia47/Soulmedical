import { useEffect, useState } from "react";
import {
  getUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  toggleUserActiveApi,
  type UserApiData,
} from "../services/api";
import GroupsPage from "./GroupsPage";
import ConfirmModal from "../components/common/ConfirmModal";
import UserListItem from "../components/users/UserListItem";
import UserFormModal, { type UserFormValues } from "../components/users/UserFormModal";
import Icon from "../components/common/Icon";

const EMPTY_FORM: UserFormValues = {
  name: "",
  email: "",
  password: "",
  role: "user",
  documentNumber: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [mainTab, setMainTab] = useState<"usuarios" | "grupos">("usuarios");
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserApiData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserApiData | null>(null);
  const [search, setSearch] = useState("");

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsersApi();
    if (res.data) setUsers(res.data);
    else setErrorMsg(res.error ?? "Error al cargar usuarios");
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      search.trim() === "" ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (values: UserFormValues) => {
    if (!values.name.trim() || !values.email.trim() || !values.password.trim()) {
      setFormError("Todos los campos son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError("");
    const res = await createUserApi(values);
    setSaving(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setShowNewUser(false);
    loadUsers();
  };

  const handleSaveEdit = async (values: UserFormValues) => {
    if (!editingUser) return;
    if (!values.name.trim() || !values.email.trim()) {
      setFormError("Nombre y correo son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError("");
    const dto: {
      name: string;
      email: string;
      role: string;
      password?: string;
      documentNumber?: string;
    } = {
      name: values.name,
      email: values.email,
      role: values.role,
      documentNumber: values.documentNumber ?? "",
    };
    if (values.password.trim()) dto.password = values.password;
    const res = await updateUserApi(editingUser.id, dto);
    setSaving(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
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

  return (
    <div className="flex h-screen flex-col bg-[#f0f4f8]">
      <div className="flex flex-shrink-0 border-b border-slate-200 bg-white px-2 sm:px-6">
        {([["usuarios", "Usuarios", "users"], ["grupos", "Grupos", "tag"]] as const).map(([t, label, ic]) => {
          const active = mainTab === t;
          return (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-none bg-transparent px-3.5 py-3.5 font-sans text-sm transition-all sm:px-5"
              style={{
                borderBottomColor: active ? "#00c2a8" : "transparent",
                fontWeight: active ? 700 : 500,
                color: active ? "#00c2a8" : "#6b7280",
              }}
            >
              <Icon name={ic} size={16} /> {label}
            </button>
          );
        })}
      </div>

      {mainTab === "grupos" ? (
        <div className="min-h-0 flex-1">
          <GroupsPage />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 sm:py-8">
            <div className="animate-fade-up mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="m-0 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  Gestión de Usuarios
                </h1>
                <p className="mt-1 text-[13px] text-slate-400">
                  {users.length} usuario{users.length !== 1 ? "s" : ""} registrado
                  {users.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  setFormError("");
                  setShowNewUser(true);
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-none px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)]"
                style={{ background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)" }}
              >
                <Icon name="plus" size={16} /> Nuevo usuario
              </button>
            </div>

            <div className="animate-fade-up relative mb-5 max-w-[360px]" style={{ animationDelay: "60ms" }}>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="box-border w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3 py-2.5 pl-9 text-sm text-slate-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
              />
            </div>

            {loading ? (
              <div className="px-6 py-14 text-center text-gray-400">
                Cargando usuarios...
              </div>
            ) : errorMsg ? (
              <div className="p-10 text-center text-red-600">{errorMsg}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="animate-fade-up rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00c2a8]/10 text-[#00c2a8]">
                  <Icon name="users" size={30} />
                </div>
                <p className="text-lg font-extrabold tracking-tight text-slate-800">
                  No hay usuarios registrados
                </p>
                <p className="mt-1 text-[13px] text-slate-400">
                  Crea el primer usuario con el botón de arriba
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredUsers.map((user, i) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    index={i}
                    onEdit={(u) => {
                      setFormError("");
                      setEditingUser(u);
                    }}
                    onToggleActive={handleToggleActive}
                    onDelete={(u) => setConfirmDelete(u)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showNewUser && (
        <UserFormModal
          mode="create"
          initialValues={EMPTY_FORM}
          saving={saving}
          error={formError}
          onSubmit={handleCreate}
          onClose={() => setShowNewUser(false)}
        />
      )}

      {editingUser && (
        <UserFormModal
          mode="edit"
          editingUser={editingUser}
          initialValues={{
            name: editingUser.name,
            email: editingUser.email,
            documentNumber: editingUser.documentNumber ?? "",
            password: "",
            role: editingUser.role as UserFormValues["role"],
          }}
          saving={saving}
          error={formError}
          onSubmit={handleSaveEdit}
          onClose={() => setEditingUser(null)}
          onUserChanged={loadUsers}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar usuario?"
          message={`Se eliminará a <strong>${confirmDelete.name}</strong> permanentemente.`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
