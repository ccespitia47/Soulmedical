import { useEffect, useState } from "react";
import type { UserApiData } from "../../services/api";
import { updateUserPermissionsApi } from "../../services/api";
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  ROLE_BASE_PERMISSIONS,
  type Permission,
  type UserRole,
} from "../../types/auth.types";

type PermissionsTabProps = {
  user: UserApiData;
  onSaved?: (updated: UserApiData) => void;
};

export default function PermissionsTab({ user, onSaved }: PermissionsTabProps) {
  const role = user.role as UserRole;
  const basePerms = ROLE_BASE_PERMISSIONS[role] ?? [];
  const [extra, setExtra] = useState<Permission[]>(
    (user.permissions ?? []).filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setExtra(
      (user.permissions ?? []).filter((p): p is Permission =>
        ALL_PERMISSIONS.includes(p as Permission),
      ),
    );
  }, [user.id, user.permissions]);

  const togglePerm = (perm: Permission) => {
    if (basePerms.includes(perm)) return; // viene del rol, no se puede tocar
    setExtra((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const res = await updateUserPermissionsApi(user.id, extra);
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error ?? "No se pudo guardar.");
      return;
    }
    setSavedAt(Date.now());
    onSaved?.(res.data);
  };

  return (
    <div>
      <p className="m-0 mb-4 text-[13px] text-gray-500">
        Estos permisos se <strong>suman</strong> a los que ya da el rol{" "}
        <strong>{role}</strong>. No se pueden quitar los que vienen del rol.
      </p>

      <div className="flex flex-col gap-2.5">
        {ALL_PERMISSIONS.map((perm) => {
          const fromRole = basePerms.includes(perm);
          const checked = fromRole || extra.includes(perm);
          return (
            <label
              key={perm}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] p-3 transition ${
                fromRole
                  ? "border-slate-200 bg-slate-50 opacity-70"
                  : checked
                    ? "border-[#00c2a8] bg-[#00c2a8]/5"
                    : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={fromRole}
                onChange={() => togglePerm(perm)}
                className="mt-0.5 h-4 w-4 accent-[#00c2a8]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">
                    {PERMISSION_LABELS[perm]}
                  </span>
                  {fromRole && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Del rol
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-gray-500">
                  {PERMISSION_DESCRIPTIONS[perm]}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="m-0 mt-3 text-[13px] text-red-600">⚠️ {error}</p>
      )}
      {savedAt && !error && (
        <p className="m-0 mt-3 text-[13px] text-emerald-600">
          ✓ Permisos guardados. Tomarán efecto inmediatamente.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer rounded-lg border-none bg-[#00c2a8] px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar permisos"}
        </button>
      </div>
    </div>
  );
}
