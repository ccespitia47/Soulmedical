import { useEffect, useState } from "react";
import {
  getUsersApi,
  getGroupMembersApi,
  addGroupMemberApi,
  removeGroupMemberApi,
  type UserApiData,
} from "../../services/api";
import { ROLE_AVATARS, ROLE_LABELS, type UserRole } from "../../types/auth.types";

type MembersPanelProps = {
  groupId: string;
  groupColor: string;
};

export default function MembersPanel({ groupId, groupColor }: MembersPanelProps) {
  const [allUsers, setAllUsers] = useState<UserApiData[]>([]);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [usersRes, membersRes] = await Promise.all([
        getUsersApi(),
        getGroupMembersApi(groupId),
      ]);
      setAllUsers(usersRes.data ?? []);
      const ids = new Set((membersRes.data ?? []).map((m) => m.userId));
      setMemberIds(new Set(ids));
      setOriginalIds(new Set(ids));
      setLoading(false);
    };
    load();
  }, [groupId]);

  const toggle = (userId: number) => {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const toAdd = [...memberIds].filter((id) => !originalIds.has(id));
    const toRemove = [...originalIds].filter((id) => !memberIds.has(id));
    await Promise.all([
      ...toAdd.map((id) => addGroupMemberApi(groupId, id)),
      ...toRemove.map((id) => removeGroupMemberApi(groupId, id)),
    ]);
    setOriginalIds(new Set(memberIds));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading)
    return <div className="py-7 text-center text-[13px] text-gray-400">Cargando...</div>;

  return (
    <div>
      <p className="m-0 mb-3 text-xs text-gray-500">
        {memberIds.size} miembro{memberIds.size !== 1 ? "s" : ""} en este grupo
      </p>
      <div className="mb-3.5 flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
        {allUsers
          .filter((u) => u.role !== "admin")
          .map((user) => {
            const checked = memberIds.has(user.id);
            return (
              <div
                key={user.id}
                onClick={() => toggle(user.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-2.5 transition-all"
                style={{
                  borderColor: checked ? groupColor + "44" : "#e2e8f0",
                  background: checked ? groupColor + "10" : "#fff",
                }}
              >
                <div
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px]"
                  style={{
                    border: `2px solid ${checked ? groupColor : "#d1d5db"}`,
                    background: checked ? groupColor : "#fff",
                  }}
                >
                  {checked && <span className="text-[13px] text-white">✓</span>}
                </div>
                <span className="text-xl">{ROLE_AVATARS[user.role as UserRole]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-gray-900">{user.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {user.email} · {ROLE_LABELS[user.role as UserRole]}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="cursor-pointer rounded-lg border-none px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
        style={{ background: saved ? "#10b981" : "#00c2a8" }}
      >
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "💾 Guardar miembros"}
      </button>
    </div>
  );
}
