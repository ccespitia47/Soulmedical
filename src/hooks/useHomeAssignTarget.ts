import { useState } from "react";
import {
  getUsersApi,
  assignFormToUserApi,
  unassignFormFromUserApi,
  getFormAssignmentsApi,
  getProjectAssignmentsApi,
  assignProjectToUserApi,
  unassignProjectFromUserApi,
  type UserApiData,
} from "../services/api";

export type AssignTarget = {
  id: string;
  name: string;
  kind: "form" | "project";
  folderId?: string;
};

export function useHomeAssignTarget() {
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [allUsers, setAllUsers] = useState<UserApiData[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<number>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<number>>(new Set());
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const openAssignTarget = async (target: AssignTarget) => {
    setAssignTarget(target);
    setLoadingAssign(true);
    const [ur, ar] = await Promise.all([
      getUsersApi(),
      target.kind === "form"
        ? getFormAssignmentsApi(target.id)
        : getProjectAssignmentsApi(target.id),
    ]);
    setAllUsers((ur.data ?? []).filter((u) => u.role !== "admin"));
    const ids = new Set((ar.data ?? []).map((a) => a.userId));
    setAssignedUserIds(new Set(ids));
    setOriginalAssignedIds(new Set(ids));
    setLoadingAssign(false);
  };

  const toggleUserId = (id: number) =>
    setAssignedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSaveAssignments = async () => {
    if (!assignTarget) return;
    setSavingAssign(true);
    const toAdd = [...assignedUserIds].filter((id) => !originalAssignedIds.has(id));
    const toRemove = [...originalAssignedIds].filter((id) => !assignedUserIds.has(id));
    const addFn =
      assignTarget.kind === "form" ? assignFormToUserApi : assignProjectToUserApi;
    const removeFn =
      assignTarget.kind === "form"
        ? unassignFormFromUserApi
        : unassignProjectFromUserApi;
    await Promise.all([
      ...toAdd.map((id) => addFn(assignTarget.id, id)),
      ...toRemove.map((id) => removeFn(assignTarget.id, id)),
    ]);
    setSavingAssign(false);
    setAssignTarget(null);
  };

  const close = () => setAssignTarget(null);

  return {
    assignTarget,
    allUsers,
    assignedUserIds,
    loadingAssign,
    savingAssign,
    openAssignTarget,
    toggleUserId,
    handleSaveAssignments,
    close,
  };
}
