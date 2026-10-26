import { useEffect, useState } from "react";
import {
  getGroupsApi,
  createGroupApi,
  updateGroupApi,
  deleteGroupApi,
  type GroupData,
} from "../services/api";
import ConfirmModal from "../components/common/ConfirmModal";
import Icon from "../components/common/Icon";
import EntityIcon from "../components/common/EntityIcon";
import GroupsSidebar from "../components/groups/GroupsSidebar";
import MembersPanel from "../components/groups/MembersPanel";
import GroupAssignmentsPanel from "../components/groups/GroupAssignmentsPanel";
import GroupFormModal, { type GroupFormValues } from "../components/groups/GroupFormModal";

const EMPTY_FORM: GroupFormValues = {
  name: "",
  description: "",
  color: "#6366f1",
  icon: "users",
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "assignments">("members");
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupData | null>(null);
  const [formValues, setFormValues] = useState<GroupFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadGroups = async () => {
    setLoading(true);
    const res = await getGroupsApi();
    if (res.data) setGroups(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const openNew = () => {
    setFormValues(EMPTY_FORM);
    setFormError("");
    setEditingGroup(null);
    setShowModal(true);
  };

  const openEdit = (g: GroupData) => {
    setFormValues({
      name: g.name,
      description: g.description,
      color: g.color,
      icon: g.icon,
    });
    setFormError("");
    setEditingGroup(g);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formValues.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError("");
    if (editingGroup) {
      await updateGroupApi(editingGroup.id, formValues);
    } else {
      const res = await createGroupApi(formValues);
      if (res.error) {
        setFormError(res.error);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setShowModal(false);
    loadGroups();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteGroupApi(confirmDelete.id);
    if (selectedGroup?.id === confirmDelete.id) setSelectedGroup(null);
    setConfirmDelete(null);
    loadGroups();
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f0f4f8] font-sans">
      <GroupsSidebar
        groups={groups}
        loading={loading}
        selectedId={selectedGroup?.id ?? null}
        onSelect={(g) => {
          setSelectedGroup(g);
          setActiveTab("members");
        }}
        onCreate={openNew}
        onEdit={openEdit}
        onDelete={(g) => setConfirmDelete(g)}
      />

      {selectedGroup ? (
        <div className="flex flex-1 flex-col">
          <div className="animate-fade-up flex h-[68px] items-center gap-3.5 border-b border-slate-200 bg-white px-6">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm"
              style={{
                background: selectedGroup.color + "1f",
                color: selectedGroup.color,
              }}
            >
              <EntityIcon icon={selectedGroup.icon} size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-[19px] font-extrabold tracking-tight text-slate-900">
                {selectedGroup.name}
              </h1>
              {selectedGroup.description && (
                <p className="m-0 truncate text-[12.5px] text-gray-400">{selectedGroup.description}</p>
              )}
            </div>
          </div>

          <div className="flex gap-1 border-b border-slate-200 bg-white px-6">
            {([["members", "Miembros", "users"], ["assignments", "Asignaciones", "folder"]] as const).map(
              ([tab, label, icon]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 border-none bg-transparent px-4 py-3 font-sans text-[13px] transition-all"
                  style={{
                    borderBottomColor:
                      activeTab === tab ? selectedGroup.color : "transparent",
                    fontWeight: activeTab === tab ? 700 : 500,
                    color: activeTab === tab ? selectedGroup.color : "#94a3b8",
                  }}
                >
                  <Icon name={icon} size={15} /> {label}
                </button>
              )
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "members" ? (
              <MembersPanel
                key={selectedGroup.id}
                groupId={selectedGroup.id}
                groupColor={selectedGroup.color}
              />
            ) : (
              <GroupAssignmentsPanel key={selectedGroup.id} groupId={selectedGroup.id} />
            )}
          </div>
        </div>
      ) : (
        <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#00c2a8]/10 text-[#00c2a8]">
            <Icon name="tag" size={40} />
          </div>
          <p className="m-0 text-lg font-extrabold tracking-tight text-slate-700">Selecciona un grupo</p>
          <p className="m-0 max-w-[340px] text-[13px] text-gray-400">
            Elige un grupo del panel izquierdo para ver sus miembros y asignaciones
          </p>
        </div>
      )}

      {showModal && (
        <GroupFormModal
          mode={editingGroup ? "edit" : "create"}
          values={formValues}
          saving={saving}
          error={formError}
          onChange={setFormValues}
          onSubmit={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar grupo?"
          message={`Se eliminará <strong>${confirmDelete.name}</strong> y todas sus asignaciones.`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
