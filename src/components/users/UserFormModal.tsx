import { useState } from "react";
import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, ROLE_AVATARS, type UserRole } from "../../types/auth.types";
import AssignmentsTab from "./AssignmentsTab";
import { ROLE_COLORS } from "./UserListItem";

const ROLES: UserRole[] = ["admin", "coordinator", "user"];
const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2.5 font-sans text-sm text-gray-900 outline-none";
const BTN_PRIMARY =
  "cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed";
const BTN_GHOST =
  "cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2.5 text-[13px] font-semibold text-gray-500";

export type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

type UserFormModalProps = {
  mode: "create" | "edit";
  editingUser?: UserApiData;
  initialValues: UserFormValues;
  saving: boolean;
  error: string;
  onSubmit: (values: UserFormValues) => void;
  onClose: () => void;
};

function FormFields({
  values,
  mode,
  onChange,
}: {
  values: UserFormValues;
  mode: "create" | "edit";
  onChange: (v: UserFormValues) => void;
}) {
  return (
    <>
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
        Nombre completo
      </label>
      <input
        className={INPUT_CLASS}
        placeholder="Ej: Juan Pérez"
        value={values.name}
        onChange={(e) => onChange({ ...values, name: e.target.value })}
        autoFocus
      />
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
        Correo electrónico
      </label>
      <input
        className={INPUT_CLASS}
        type="email"
        placeholder="usuario@empresa.com"
        value={values.email}
        onChange={(e) => onChange({ ...values, email: e.target.value })}
      />
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
        {mode === "edit" ? (
          <>
            Nueva contraseña{" "}
            <span className="font-normal text-gray-400">(dejar vacío para no cambiar)</span>
          </>
        ) : (
          "Contraseña"
        )}
      </label>
      <input
        className={INPUT_CLASS}
        type="password"
        placeholder={mode === "edit" ? "••••••••" : "Mínimo 6 caracteres"}
        value={values.password}
        onChange={(e) => onChange({ ...values, password: e.target.value })}
      />
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">Rol</label>
      <select
        value={values.role}
        onChange={(e) => onChange({ ...values, role: e.target.value as UserRole })}
        className={`${INPUT_CLASS} cursor-pointer appearance-none`}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </>
  );
}

export default function UserFormModal({
  mode,
  editingUser,
  initialValues,
  saving,
  error,
  onSubmit,
  onClose,
}: UserFormModalProps) {
  const [values, setValues] = useState<UserFormValues>(initialValues);
  const [editTab, setEditTab] = useState<"info" | "assignments">("info");

  const role = editingUser?.role as UserRole | undefined;
  const color = role ? ROLE_COLORS[role] : "#00c2a8";

  if (mode === "create") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
        <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <h2 className="m-0 mb-5 text-lg font-bold text-gray-900">Nuevo Usuario</h2>
          <FormFields values={values} mode="create" onChange={setValues} />
          {error && <p className="m-0 mb-3 text-[13px] text-red-600">⚠️ {error}</p>}
          <div className="flex justify-end gap-2.5">
            <button className={BTN_GHOST} onClick={onClose}>
              Cancelar
            </button>
            <button
              className={BTN_PRIMARY}
              onClick={() => onSubmit(values)}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5">
      <div
        className="flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        style={{ maxWidth: editTab === "assignments" ? 580 : 440 }}
      >
        <div className="px-6 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-xl"
                style={{
                  background: `${color}18`,
                  border: `2px solid ${color}33`,
                }}
              >
                {role ? ROLE_AVATARS[role] : ""}
              </div>
              <div>
                <div className="text-[15px] font-bold text-gray-900">
                  {editingUser?.name}
                </div>
                <div className="text-[11px] text-gray-500">{editingUser?.email}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-sm text-slate-500"
            >
              ✕
            </button>
          </div>

          <div className="flex border-b border-slate-200">
            {([["info", "👤 Información"], ["assignments", "🗂️ Asignaciones"]] as const).map(
              ([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setEditTab(tab)}
                  className="-mb-px cursor-pointer border-b-2 border-none bg-transparent px-4 py-2 font-sans text-[13px] transition-all"
                  style={{
                    borderBottomColor: editTab === tab ? "#00c2a8" : "transparent",
                    fontWeight: editTab === tab ? 700 : 500,
                    color: editTab === tab ? "#00c2a8" : "#6b7280",
                  }}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {editTab === "info" ? (
            <>
              <FormFields values={values} mode="edit" onChange={setValues} />
              {error && <p className="m-0 mb-3 text-[13px] text-red-600">⚠️ {error}</p>}
              <div className="flex justify-end gap-2.5">
                <button className={BTN_GHOST} onClick={onClose}>
                  Cancelar
                </button>
                <button
                  className={BTN_PRIMARY}
                  onClick={() => onSubmit(values)}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </>
          ) : (
            editingUser && <AssignmentsTab userId={editingUser.id} />
          )}
        </div>
      </div>
    </div>
  );
}
