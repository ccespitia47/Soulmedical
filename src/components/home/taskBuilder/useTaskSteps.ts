import { useState } from "react";
import {
  getGroupMembersApi,
  type GroupData,
} from "../../../services/api";
import { uid, type SimpleUser, type Step } from "./types";

type GroupMember = { userId: number; email: string; name: string };

/**
 * Estado de los destinatarios en la pantalla "Destinatarios" de CreateTaskModal.
 *
 * Modelo unificado: cada Step tiene una lista de `emails` (todos paralelos —
 * el paso avanza cuando TODOS diligencian) más un mapa opcional
 * `namesByEmail` para los que vinieron del dropdown de usuarios. NO existe
 * la separación "primer email + otros paralelos": la caja del step muestra
 * todos los correos como chips por igual.
 *
 * Un segundo Step aparece solo cuando el admin lo agrega explícitamente
 * con "+ Agregar otro destinatario" (flujo de aprobación con firma).
 */
export function useTaskSteps(allUsers: SimpleUser[]) {
  const [steps, setSteps] = useState<Step[]>([
    { id: uid(), emails: [], namesByEmail: {} },
  ]);
  const [showDropdown, setShowDropdown] = useState<Record<string, boolean>>({});
  const [groupMembers, setGroupMembers] = useState<
    Record<string, GroupMember[]>
  >({});

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { id: uid(), emails: [], namesByEmail: {} },
    ]);

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

  const setShowDropdownFor = (stepId: string, show: boolean) =>
    setShowDropdown((prev) => ({ ...prev, [stepId]: show }));

  /**
   * Sustituye la lista completa de emails de un step. El caller es quien
   * decide qué queda (agregar/quitar chips, dedupe, etc.). Preserva los
   * nombres de los emails que sigan presentes.
   */
  const setStepEmails = (stepId: string, emails: string[]) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const keep: Record<string, string> = {};
        for (const e of emails) {
          if (s.namesByEmail[e]) keep[e] = s.namesByEmail[e];
        }
        return { ...s, emails, namesByEmail: keep };
      }),
    );
  };

  /** Agrega el email de un usuario seleccionado por dropdown (dedupe). */
  const addUserToStep = (stepId: string, user: SimpleUser) => {
    const email = user.email.trim().toLowerCase();
    if (!email) return;
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        if (s.emails.some((e) => e.toLowerCase() === email)) return s;
        return {
          ...s,
          emails: [...s.emails, email],
          namesByEmail: { ...s.namesByEmail, [email]: user.name },
        };
      }),
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

  /**
   * Agrega TODOS los miembros del grupo como chips paralelos DENTRO del
   * step actual (todos reciben el formulario en paralelo). Antes esto
   * creaba N steps secuenciales; el nuevo modelo asume que un grupo son
   * personas que responden en paralelo, no una cadena secuencial.
   */
  const handleAddGroupMembers = async (stepId: string, group: GroupData) => {
    const members = await loadGroupMembers(group.id);
    if (members.length === 0) return;
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const existing = new Set(s.emails.map((e) => e.toLowerCase()));
        const emails = [...s.emails];
        const namesByEmail = { ...s.namesByEmail };
        for (const m of members) {
          const email = m.email.trim().toLowerCase();
          if (!email || existing.has(email)) continue;
          existing.add(email);
          emails.push(email);
          if (m.name) namesByEmail[email] = m.name;
        }
        return { ...s, emails, namesByEmail };
      }),
    );
    setShowDropdownFor(stepId, false);
  };

  return {
    steps,
    showDropdown,
    addStep,
    removeStep,
    moveStep,
    setStepEmails,
    addUserToStep,
    setShowDropdownFor,
    handleAddGroupMembers,
  };
}
