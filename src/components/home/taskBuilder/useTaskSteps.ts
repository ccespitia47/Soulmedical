import { useState } from "react";
import {
  getGroupMembersApi,
  type GroupData,
} from "../../../services/api";
import {
  uid,
  type Recipient,
  type SimpleUser,
  type Step,
} from "./types";

type GroupMember = { userId: number; email: string; name: string };

export function useTaskSteps(allUsers: SimpleUser[]) {
  const [steps, setSteps] = useState<Step[]>([
    { id: uid(), recipient: null, inputEmail: "", inputName: "" },
  ]);
  const [showDropdown, setShowDropdown] = useState<Record<string, boolean>>({});
  const [groupMembers, setGroupMembers] = useState<
    Record<string, GroupMember[]>
  >({});

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { id: uid(), recipient: null, inputEmail: "", inputName: "" },
    ]);

  // Garantiza que existan al menos N destinatarios. Si el formulario tiene
  // firmas asignadas a pasos 1..N, llamamos ensureStepCount(N) para que el
  // admin vea una caja por cada firma que debe asignar.
  const ensureStepCount = (n: number) =>
    setSteps((prev) => {
      if (prev.length >= n) return prev;
      const missing = n - prev.length;
      const extra: Step[] = Array.from({ length: missing }, () => ({
        id: uid(),
        recipient: null,
        inputEmail: "",
        inputName: "",
      }));
      return [...prev, ...extra];
    });

  const removeStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id));

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const setStepExternal = (stepId: string, email: string, name: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              inputEmail: email,
              inputName: name,
              recipient: email
                ? { id: uid(), email, name: name || email, source: "external" }
                : null,
            }
          : s,
      ),
    );
  };

  const setShowDropdownFor = (stepId: string, show: boolean) =>
    setShowDropdown((prev) => ({ ...prev, [stepId]: show }));

  const setStepRecipient = (stepId: string, r: Recipient) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, recipient: r, inputEmail: r.email, inputName: r.name }
          : s,
      ),
    );
    setShowDropdownFor(stepId, false);
  };

  const loadGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    if (groupMembers[groupId]) return groupMembers[groupId];
    const res = await getGroupMembersApi(groupId);
    if (!res.data) return [];
    const members = res.data
      .map((m) => {
        const raw = m as Record<string, unknown>;
        const userId = (raw.userId ?? raw.user_id) as number | undefined;
        const user = userId ? allUsers.find((u) => u.id === userId) : undefined;
        return {
          userId: userId ?? 0,
          email: user?.email || (raw.email as string) || "",
          name: user?.name || (raw.name as string) || "",
        };
      })
      .filter((m) => m.email);
    setGroupMembers((prev) => ({ ...prev, [groupId]: members }));
    return members;
  };

  const handleAddGroupMembers = async (stepId: string, group: GroupData) => {
    const members = await loadGroupMembers(group.id);
    if (members.length === 0) return;
    setSteps((prev) => {
      const without = prev.filter((s) => s.id !== stepId);
      const newSteps: Step[] = members.map((m) => ({
        id: uid(),
        recipient: {
          id: String(m.userId),
          email: m.email,
          name: m.name,
          source: "group",
        },
        inputEmail: m.email,
        inputName: m.name,
      }));
      return [...without, ...newSteps];
    });
    setShowDropdownFor(stepId, false);
  };

  return {
    steps,
    showDropdown,
    addStep,
    ensureStepCount,
    removeStep,
    moveStep,
    setStepExternal,
    setStepRecipient,
    setShowDropdownFor,
    handleAddGroupMembers,
  };
}
