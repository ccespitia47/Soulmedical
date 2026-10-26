import { useState } from "react";
import type { UserApiData } from "../../services/api";
import { ROLE_LABELS, type UserRole } from "../../types/auth.types";
import Avatar from "../common/Avatar";
import Icon from "../common/Icon";
import AssignmentsTab from "./AssignmentsTab";
import PermissionsTab from "./PermissionsTab";
import TwoFactorAdminPanel from "./TwoFactorAdminPanel";
import { ROLE_COLORS } from "./UserListItem";

const ROLES: UserRole[] = ["admin", "coordinator", "user"];
const INPUT_CLASS =
  "mb-3 box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15";
const BTN_PRIMARY =
  "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none";
const BTN_GHOST =
  "cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-gray-600 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-900";

function ErrorMsg({ error }: { error: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600">
      <Icon name="alert" size={16} className="shrink-0" />
      <span>{error}</span>
    </div>
  );
}

export type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  /** Número de documento (cédula/DNI). Usado como contraseña de reportes. */
  documentNumber: string;
};

type UserFormModalProps = {
  mode: "create" | "edit";
  editingUser?: UserApiData;
  initialValues: UserFormValues;
  saving: boolean;
  error: string;
  onSubmit: (values: UserFormValues) => void;
  onClose: () => void;
  /** Llamado tras acciones administrativas que invalidan la lista (ej. reset 2FA). */
  onUserChanged?: () => void;
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
      <label className="mb-1.5 block text-xs font-semibold uppercase text-gray-500">
        Número de documento{" "}
        <span className="font-normal text-gray-400">
          (requerido para solicitar reportes por correo)
        </span>
      </label>
      <input
        className={INPUT_CLASS}
        placeholder="Ej: 1085123456"
        value={values.documentNumber}
        onChange={(e) => onChange({ ...values, documentNumber: e.target.value })}
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
  onUserChanged,
}: UserFormModalProps) {
  const [values, setValues] = useState<UserFormValues>(initialValues);
  const [editTab, setEditTab] = useState<"info" | "assignments" | "permissions">(
    "info",
  );

  const role = editingUser?.role as UserRole | undefined;
  const color = role ? ROLE_COLORS[role] : "#00c2a8";

  if (mode === "create") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
        <div className="animate-modal-in max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-[20px] bg-white p-6 shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]">
          {/* Header */}
          <div className="mb-5 flex items-start gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.6)]">
              <Icon name="user" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[20px] font-extrabold tracking-tight text-slate-900">
                Nuevo usuario
              </h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-gray-400">
                Completa los datos para crear la cuenta.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="x" size={17} />
            </button>
          </div>
          <FormFields values={values} mode="create" onChange={setValues} />
          {error && <ErrorMsg error={error} />}
          <div className="flex justify-end gap-2.5">
            <button className={BTN_GHOST} onClick={onClose}>
              Cancelar
            </button>
            <button
              className={BTN_PRIMARY}
              onClick={() => onSubmit(values)}
              disabled={saving}
            >
              <Icon name="checkCircle" size={15} />
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
        className="animate-modal-in flex max-h-[90vh] w-full flex-col rounded-[20px] bg-white shadow-[0_28px_70px_-18px_rgba(15,40,80,0.4)]"
        style={{ maxWidth: editTab === "info" ? 440 : 580 }}
      >
        <div className="px-6 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar name={editingUser?.name ?? ""} size={38} color={color} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">
                  {editingUser?.name}
                </div>
                <div className="truncate text-[11px] text-gray-500">{editingUser?.email}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="flex overflow-x-auto border-b border-slate-200">
            {(
              [
                ["info", "Información", "user"],
                ["assignments", "Asignaciones", "folder"],
                ["permissions", "Permisos", "lock"],
              ] as const
            ).map(([tab, label, ic]) => (
                <button
                  key={tab}
                  onClick={() => setEditTab(tab)}
                  className="-mb-px flex flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-none bg-transparent px-3 py-2.5 font-sans text-[13px] transition-all sm:px-4"
                  style={{
                    borderBottomColor: editTab === tab ? "#00c2a8" : "transparent",
                    fontWeight: editTab === tab ? 700 : 500,
                    color: editTab === tab ? "#00c2a8" : "#6b7280",
                  }}
                >
                <Icon name={ic} size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {editTab === "info" && (
            <>
              <FormFields values={values} mode="edit" onChange={setValues} />
              {error && <ErrorMsg error={error} />}
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
              {editingUser && (
                <TwoFactorAdminPanel
                  user={editingUser}
                  onReset={onUserChanged}
                />
              )}
            </>
          )}
          {editTab === "assignments" && editingUser && (
            <AssignmentsTab userId={editingUser.id} />
          )}
          {editTab === "permissions" && editingUser && (
            <PermissionsTab user={editingUser} />
          )}
        </div>
      </div>
    </div>
  );
}
