import { useState } from "react";
import { updateMyProfileApi } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { sanitizePermissions } from "../../types/auth.types";
import Icon from "../common/Icon";

type Props = {
  onClose: () => void;
};

/**
 * Modal para que cualquier usuario logueado edite su propia información.
 * Solo campos "seguros" — el backend (PATCH /auth/profile) rechaza
 * cualquier intento de tocar rol, permisos, isActive o 2FA aunque el
 * cliente los mande. Esos siguen siendo exclusivos de admin.
 */
export default function EditMyProfileModal({ onClose }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(currentUser?.name ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const nameOk = trimmedName.length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const passwordChanging = password.length > 0;
  const passwordOk = !passwordChanging || (password.length >= 8 && password === passwordConfirm);

  const canSave = nameOk && emailOk && passwordOk && !saving;

  const handleSave = async () => {
    if (!canSave || !currentUser) return;
    setSaving(true);
    setError(null);
    const body: {
      name?: string;
      email?: string;
      password?: string;
      documentNumber?: string;
    } = {};
    if (trimmedName !== currentUser.name) body.name = trimmedName;
    if (trimmedEmail !== currentUser.email) body.email = trimmedEmail;
    if (documentNumber.trim().length > 0) body.documentNumber = documentNumber.trim();
    if (passwordChanging) body.password = password;

    if (Object.keys(body).length === 0) {
      setSaving(false);
      setError("No hiciste ningún cambio.");
      return;
    }

    const res = await updateMyProfileApi(body);
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error ?? "No se pudo actualizar el perfil.");
      return;
    }
    // Reflejar los cambios en el store local para que el sidebar y todo el
    // resto de la UI muestre el nuevo nombre/email inmediatamente sin
    // esperar un reload.
    setUser({
      id: res.data.id,
      name: res.data.name,
      email: res.data.email,
      role: res.data.role,
      // El AuthUser mantiene el avatar del sesión previo (backend no lo
      // devuelve; se deriva del nombre para el Avatar). Sin este spread se
      // perdía la property `avatar` requerida por el tipo AuthUser.
      avatar: currentUser?.avatar ?? "",
      permissions: sanitizePermissions(res.data.permissions),
    });
    setSaved(true);
    setTimeout(() => onClose(), 900);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-5">
      <div className="w-full max-w-[460px] rounded-2xl bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-bold text-gray-900">Editar mi perfil</h2>
            <p className="m-0 mt-1 text-[12px] text-gray-500">
              Actualiza tu información personal. El rol y el doble factor solo
              los puede modificar un administrador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nombre completo" error={!nameOk && name.length > 0 ? "Mínimo 2 caracteres" : null}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </Field>

          <Field label="Correo electrónico" error={!emailOk && email.length > 0 ? "Formato inválido" : null}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </Field>

          <Field
            label="Número de documento"
            hint="Se usa como contraseña del ZIP de reportes descargados por correo."
          >
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Dejá en blanco para no cambiarlo"
              className="w-full rounded-lg border-[1.5px] border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Cambiar contraseña (opcional)
            </div>
            <p className="mb-2.5 text-[11px] text-slate-500">
              Dejá en blanco para conservar tu contraseña actual.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña (mínimo 8 caracteres)"
              autoComplete="new-password"
              className="mb-2 w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15"
            />
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirmar contraseña"
              autoComplete="new-password"
              disabled={!passwordChanging}
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15 disabled:opacity-50"
            />
            {passwordChanging && password.length < 8 && (
              <p className="mt-1 text-[11px] text-red-600">Mínimo 8 caracteres</p>
            )}
            {passwordChanging && password.length >= 8 && password !== passwordConfirm && (
              <p className="mt-1 text-[11px] text-red-600">Las contraseñas no coinciden</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <Icon name="alert" size={14} className="mt-px flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
            <Icon name="checkCircle" size={14} className="mt-px flex-shrink-0" />
            <span>Perfil actualizado correctamente.</span>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-5 py-2 text-[13px] font-semibold text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="cursor-pointer rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
