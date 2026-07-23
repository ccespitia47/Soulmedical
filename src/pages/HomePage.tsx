import { useEffect, useMemo, useState } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";
import { FOLDER_COLORS, FOLDER_ICONS, PROJECT_COLORS, PROJECT_ICONS, type FormItem } from "../types/folder.types";
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
import { useTheme } from "../context/ThemeContext";
import { useHomePersistence } from "../hooks/useHomePersistence";
import { useAuthStore } from "../store/useAuthStore";
import { userHasPermission } from "../types/auth.types";
import ConfirmModal from "../components/common/ConfirmModal";
import EntityFormModal from "../components/common/EntityFormModal";
import RenameModal from "../components/common/RenameModal";
import HomeSidebar from "../components/home/HomeSidebar";
import { FormsView, FormsEmptyState } from "../components/home/FormsView";
import AssignUsersModal from "../components/home/AssignUsersModal";
import CreateTaskModal from "../components/home/CreateTaskModal";
import ShareFormModal from "../components/home/ShareFormModal";
import type { ProjectRowProps } from "../components/home/ProjectRow";

type HomePageProps = {
  onOpenBuilder: (folderId: string, formId: string) => void;
  onOpenForm: (folderId: string, formId: string) => void;
  currentUser?: { name: string; role: string; avatar: string } | null;
};

type AssignTarget = { id: string; name: string; kind: "form" | "project"; folderId?: string };

export default function HomePage({ onOpenBuilder, onOpenForm, currentUser }: HomePageProps) {
  const {
    folders, addFolder, deleteFolder, updateFolder, addForm, deleteForm, renameForm,
    selectFolder, selectedFolderId, duplicateFolder, duplicateForm, loadFolders,
    setFormShareFlags,
  } = useFolderStore();
  const { projects, selectedProjectId, addProject, deleteProject, updateProject, selectProject, loadProjects } =
    useProjectStore();
  const { T, D } = useTheme();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.currentUser);
  const canCreateForms = userHasPermission(authUser, "forms_create");
  const canEditForms = userHasPermission(authUser, "forms_edit");
  const canDeleteForms = userHasPermission(authUser, "forms_delete");
  const { pinnedIds, togglePin, recents, addRecent, favorites, toggleFavorite } = useHomePersistence();

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selectedProjectId) loadFolders(selectedProjectId); }, [selectedProjectId]);
  useEffect(() => {
    if (selectedProjectId)
      setExpandedProjects((prev) => {
        if (prev.has(selectedProjectId)) return prev;
        const next = new Set(prev);
        next.add(selectedProjectId);
        return next;
      });
  }, [selectedProjectId]);

  // Modales de creación/edición
  const [showNewProject, setShowNewProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingForm, setEditingForm] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [editFormName, setEditFormName] = useState("");

  // Modales de confirmación
  const [confirmDelete, setConfirmDelete] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState<{ folderId: string; formId: string; formName: string } | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<{ folderId: string; folderName: string } | null>(null);
  const [confirmDuplicateFolder, setConfirmDuplicateFolder] = useState<{ folderId: string; folderName: string } | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ projectId: string; projectName: string } | null>(null);

  // Asignación de usuarios
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [allUsers, setAllUsers] = useState<UserApiData[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<number>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<number>>(new Set());
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  // ← NUEVO: modal de tareas
  const [taskForm, setTaskForm] = useState<{
    formId: string;
    folderId: string;
    formName: string;
    widgets: any[];
  } | null>(null);

  const [shareForm, setShareForm] = useState<{
    formId: string;
    folderId: string;
    formName: string;
    isPublic: boolean;
    sendConfirmationEmail: boolean;
    requiresEmailVerification: boolean;
  } | null>(null);

  // Inputs de formularios
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#00c2a8");
  const [folderIcon, setFolderIcon] = useState("📁");
  const [newFormName, setNewFormName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#00c2a8");
  const [projectIcon, setProjectIcon] = useState("🏢");

  // Derivados
  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );
  const formCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    folders.forEach((f) => { map.set(f.projectId, (map.get(f.projectId) ?? 0) + f.forms.length); });
    return map;
  }, [folders]);
  const pinnedProjects = useMemo(() => projects.filter((p) => pinnedIds.includes(p.id)), [projects, pinnedIds]);
  const unpinnedProjects = useMemo(() => projects.filter((p) => !pinnedIds.includes(p.id)), [projects, pinnedIds]);

  // Navegación
  const handleOpenForm = (folderId: string, formId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (folder && form) addRecent({ formId, folderId, formName: form.name, folderName: folder.name });
    onOpenForm(folderId, formId);
  };
  const handleOpenBuilder = (folderId: string, formId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    if (folder && form) addRecent({ formId, folderId, formName: form.name, folderName: folder.name });
    onOpenBuilder(folderId, formId);
  };
  const handleNavigateToForm = (folderId: string, _formId: string) => {
    const projectId = folders.find((f) => f.id === folderId)?.projectId;
    selectProject(projectId ?? "");
    selectFolder(folderId);
    if (projectId)
      setExpandedProjects((prev) => { const next = new Set(prev); next.add(projectId); return next; });
  };

  // CRUD
  const handleCreateFolder = () => {
    if (!folderName.trim() || !selectedProjectId) return;
    addFolder(folderName.trim(), folderColor, folderIcon, selectedProjectId);
    setFolderName(""); setFolderColor("#00c2a8"); setFolderIcon("📁"); setShowNewFolder(false);
  };
  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    addProject(projectName.trim(), projectColor, projectIcon);
    setProjectName(""); setProjectColor("#00c2a8"); setProjectIcon("🏢"); setShowNewProject(false);
  };
  const handleOpenEditProject = (id: string) => {
    const p = projects.find((p) => p.id === id);
    if (!p) return;
    setProjectName(p.name); setProjectColor(p.color); setProjectIcon(p.icon);
    setEditingProjectId(id); setShowEditProject(true);
  };
  const handleSaveEditProject = () => {
    if (!editingProjectId || !projectName.trim()) return;
    updateProject(editingProjectId, { name: projectName, color: projectColor, icon: projectIcon });
    setShowEditProject(false); setEditingProjectId(null);
  };
  const handleOpenEditFolder = (id: string) => {
    const f = folders.find((f) => f.id === id);
    if (!f) return;
    setFolderName(f.name); setFolderColor(f.color); setFolderIcon(f.icon);
    setEditingFolder(id); setShowEditFolder(true);
  };
  const handleSaveEditFolder = () => {
    if (!editingFolder || !folderName.trim()) return;
    updateFolder(editingFolder, { name: folderName, color: folderColor, icon: folderIcon });
    setShowEditFolder(false); setEditingFolder(null);
  };
  const handleCreateForm = () => {
    if (!newFormName.trim() || !selectedFolderId) return;
    addForm(selectedFolderId, newFormName.trim());
    setNewFormName(""); setShowNewForm(false);
  };
  const toggleProjectExpand = (id: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Asignación
  const openAssignTarget = async (target: AssignTarget) => {
    setAssignTarget(target);
    setLoadingAssign(true);
    const [ur, ar] = await Promise.all([
      getUsersApi(),
      target.kind === "form" ? getFormAssignmentsApi(target.id) : getProjectAssignmentsApi(target.id),
    ]);
    setAllUsers((ur.data ?? []).filter((u) => u.role !== "admin"));
    const ids = new Set((ar.data ?? []).map((a) => a.userId));
    setAssignedUserIds(new Set(ids));
    setOriginalAssignedIds(new Set(ids));
    setLoadingAssign(false);
  };
  const handleSaveAssignments = async () => {
    if (!assignTarget) return;
    setSavingAssign(true);
    const toAdd = [...assignedUserIds].filter((id) => !originalAssignedIds.has(id));
    const toRemove = [...originalAssignedIds].filter((id) => !assignedUserIds.has(id));
    const addFn = assignTarget.kind === "form" ? assignFormToUserApi : assignProjectToUserApi;
    const removeFn = assignTarget.kind === "form" ? unassignFormFromUserApi : unassignProjectFromUserApi;
    await Promise.all([
      ...toAdd.map((id) => addFn(assignTarget.id, id)),
      ...toRemove.map((id) => removeFn(assignTarget.id, id)),
    ]);
    setSavingAssign(false);
    setAssignTarget(null);
  };

  const buildProjectRowProps = (project: ProjectRowProps["project"]): ProjectRowProps => ({
    project,
    isActive: selectedProjectId === project.id,
    isExpanded: expandedProjects.has(project.id),
    isAnclado: pinnedIds.includes(project.id),
    totalForms: formCountByProject.get(project.id) ?? 0,
    projectFolders: folders.filter((f) => f.projectId === project.id),
    selectedFolderId,
    T, D,
    onSelect: () => selectProject(project.id),
    onToggleExpand: () => toggleProjectExpand(project.id),
    onTogglePin: () => togglePin(project.id),
    onEdit: () => handleOpenEditProject(project.id),
    onAssign: () => openAssignTarget({ id: project.id, name: project.name, kind: "project" }),
    onDelete: () => setConfirmDeleteProject({ projectId: project.id, projectName: project.name }),
    onSelectFolder: (id: string) => selectFolder(id),
    onNewFolder: () => setShowNewFolder(true),
    onEditFolder: (id: string) => handleOpenEditFolder(id),
    onDupFolder: (id: string, name: string) => setConfirmDuplicateFolder({ folderId: id, folderName: name }),
    onDelFolder: (id: string, name: string) => setConfirmDeleteFolder({ folderId: id, folderName: name }),
  });

  const buildFormActions = (form: FormItem) => {
    if (!selectedFolder) {
      return {
        T, isFav: false, onToggleFav: () => {},
        onDuplicate: () => {}, onAssign: () => {},
        onCreateTask: () => {},
        onShare: () => {},
      };
    }
    const isFav = favorites.includes(form.id);
    return {
      T,
      isFav,
      onToggleFav: () => toggleFavorite(form.id),
      // Editar y Eliminar solo si el usuario tiene el permiso correspondiente.
      onEdit: canEditForms
        ? () => {
            setEditFormName(form.name);
            setEditingForm({ folderId: selectedFolder.id, formId: form.id, formName: form.name });
          }
        : undefined,
      onDuplicate: () => setConfirmDuplicate({ folderId: selectedFolder.id, formId: form.id, formName: form.name }),
      onAssign: () => openAssignTarget({ id: form.id, name: form.name, kind: "form", folderId: selectedFolder.id }),
      onDelete: canDeleteForms
        ? () => setConfirmDelete({ folderId: selectedFolder.id, formId: form.id, formName: form.name })
        : undefined,
      onCreateTask: () => setTaskForm({
        formId: form.id,
        folderId: selectedFolder.id,
        formName: form.name,
        widgets: form.widgets ?? [],
      }),
      onShare: () =>
        setShareForm({
          formId: form.id,
          folderId: selectedFolder.id,
          formName: form.name,
          isPublic: form.isPublic ?? false,
          sendConfirmationEmail: form.sendConfirmationEmail ?? true,
          requiresEmailVerification: form.requiresEmailVerification ?? false,
        }),
    };
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      <HomeSidebar
        projects={projects}
        pinnedProjects={pinnedProjects}
        unpinnedProjects={unpinnedProjects}
        folders={folders}
        recents={recents}
        favorites={favorites}
        buildProjectRowProps={buildProjectRowProps}
        onCreateProject={() => setShowNewProject(true)}
        onNavigateToForm={handleNavigateToForm}
      />

      {selectedFolder ? (
        <FormsView
          folder={selectedFolder}
          favorites={favorites}
          T={T}
          viewMode={viewMode}
          currentUser={currentUser}
          canCreate={canCreateForms}
          buildActions={buildFormActions}
          onChangeViewMode={setViewMode}
          onCreateForm={() => setShowNewForm(true)}
          onOpenForm={handleOpenForm}
          onOpenBuilder={handleOpenBuilder}
        />
      ) : (
        <FormsEmptyState hasProject={!!selectedProjectId} currentUser={currentUser} />
      )}

      {showNewProject && (
        <EntityFormModal title="Nuevo Proyecto" submitLabel="Crear proyecto" placeholder="Ej: Contabilidad"
          name={projectName} color={projectColor} icon={projectIcon} colors={PROJECT_COLORS} icons={PROJECT_ICONS}
          onChangeName={setProjectName} onChangeColor={setProjectColor} onChangeIcon={setProjectIcon}
          onSubmit={handleCreateProject} onClose={() => setShowNewProject(false)} />
      )}
      {showEditProject && (
        <EntityFormModal title="Editar Proyecto" submitLabel="Guardar cambios"
          name={projectName} color={projectColor} icon={projectIcon} colors={PROJECT_COLORS} icons={PROJECT_ICONS}
          onChangeName={setProjectName} onChangeColor={setProjectColor} onChangeIcon={setProjectIcon}
          onSubmit={handleSaveEditProject} onClose={() => setShowEditProject(false)} />
      )}
      {showNewFolder && (
        <EntityFormModal title="Nueva Carpeta" submitLabel="Crear carpeta" placeholder="Ej: Formularios de salud"
          name={folderName} color={folderColor} icon={folderIcon} colors={FOLDER_COLORS} icons={FOLDER_ICONS}
          onChangeName={setFolderName} onChangeColor={setFolderColor} onChangeIcon={setFolderIcon}
          onSubmit={handleCreateFolder} onClose={() => setShowNewFolder(false)} />
      )}
      {showEditFolder && (
        <EntityFormModal title="Editar Carpeta" submitLabel="Guardar cambios"
          name={folderName} color={folderColor} icon={folderIcon} colors={FOLDER_COLORS} icons={FOLDER_ICONS}
          onChangeName={setFolderName} onChangeColor={setFolderColor} onChangeIcon={setFolderIcon}
          onSubmit={handleSaveEditFolder} onClose={() => setShowEditFolder(false)} />
      )}
      {showNewForm && (
        <RenameModal title="Nuevo Formulario" submitLabel="Crear formulario" placeholder="Ej: Registro de pacientes"
          value={newFormName} onChange={setNewFormName} onSubmit={handleCreateForm} onClose={() => setShowNewForm(false)} />
      )}
      {editingForm && (
        <RenameModal title="Editar Formulario" submitLabel="Guardar"
          value={editFormName} onChange={setEditFormName}
          onSubmit={() => { if (editFormName.trim()) renameForm(editingForm.folderId, editingForm.formId, editFormName.trim()); setEditingForm(null); }}
          onClose={() => setEditingForm(null)} />
      )}
      {assignTarget && (
        <AssignUsersModal
          title={assignTarget.kind === "form" ? "👥 Asignar Usuarios al Formulario" : "👥 Asignar Usuarios al Proyecto"}
          subtitle={`${assignTarget.name} · Selecciona quiénes pueden ver este ${assignTarget.kind === "form" ? "formulario" : "proyecto"}`}
          users={allUsers} userIds={assignedUserIds} loading={loadingAssign} saving={savingAssign}
          onToggle={(id) => setAssignedUserIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
          onSave={handleSaveAssignments} onClose={() => setAssignTarget(null)} />
      )}

      {confirmDelete && (
        <ConfirmModal title="¿Eliminar formulario?" message={`Eliminarás "<strong>${confirmDelete.formName}</strong>".`}
          confirmLabel="Eliminar" confirmColor="#ef4444" onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { deleteForm(confirmDelete.folderId, confirmDelete.formId); setConfirmDelete(null); }} />
      )}
      {confirmDuplicate && (
        <ConfirmModal title="¿Duplicar formulario?" message={`Se creará una copia de "<strong>${confirmDuplicate.formName}</strong>".`}
          confirmLabel="Duplicar" confirmColor="#3b82f6" onCancel={() => setConfirmDuplicate(null)}
          onConfirm={() => { duplicateForm(confirmDuplicate.folderId, confirmDuplicate.formId); setConfirmDuplicate(null); }} />
      )}
      {confirmDeleteFolder && (
        <ConfirmModal title="¿Eliminar carpeta?" message={`Eliminarás "<strong>${confirmDeleteFolder.folderName}</strong>" y todos sus formularios.`}
          confirmLabel="Eliminar" confirmColor="#ef4444" onCancel={() => setConfirmDeleteFolder(null)}
          onConfirm={() => { deleteFolder(confirmDeleteFolder.folderId); setConfirmDeleteFolder(null); }} />
      )}
      {confirmDuplicateFolder && (
        <ConfirmModal title="¿Duplicar carpeta?" message={`Se duplicará "<strong>${confirmDuplicateFolder.folderName}</strong>".`}
          confirmLabel="Duplicar" confirmColor="#3b82f6" onCancel={() => setConfirmDuplicateFolder(null)}
          onConfirm={() => { duplicateFolder(confirmDuplicateFolder.folderId); setConfirmDuplicateFolder(null); }} />
      )}
      {confirmDeleteProject && (
        <ConfirmModal title="¿Eliminar proyecto?" message={`Eliminarás "<strong>${confirmDeleteProject.projectName}</strong>" y todo su contenido.`}
          confirmLabel="Eliminar" confirmColor="#ef4444" onCancel={() => setConfirmDeleteProject(null)}
          onConfirm={() => { deleteProject(confirmDeleteProject.projectId); setConfirmDeleteProject(null); }} />
      )}

      {/* ← NUEVO: Modal de tareas */}
      {shareForm && (
        <ShareFormModal
          formId={shareForm.formId}
          formName={shareForm.formName}
          isPublic={shareForm.isPublic}
          sendConfirmationEmail={shareForm.sendConfirmationEmail}
          requiresEmailVerification={shareForm.requiresEmailVerification}
          token={token}
          onClose={() => setShareForm(null)}
          onUpdate={(
            isPublic,
            sendConfirmationEmail,
            requiresEmailVerification,
          ) => {
            // Refrescar tanto el state del modal como el store global del
            // form, para que al cerrar y reabrir refleje el estado actual.
            setShareForm((prev) =>
              prev
                ? {
                    ...prev,
                    isPublic,
                    sendConfirmationEmail,
                    requiresEmailVerification,
                  }
                : null,
            );
            if (shareForm) {
              setFormShareFlags(
                shareForm.folderId,
                shareForm.formId,
                isPublic,
                sendConfirmationEmail,
                requiresEmailVerification,
              );
            }
          }}
        />
      )}
      {taskForm && (
        <CreateTaskModal
          formId={taskForm.formId}
          folderId={taskForm.folderId}
          formName={taskForm.formName}
          widgets={taskForm.widgets}
          onClose={() => setTaskForm(null)}
          onCreated={() => setTaskForm(null)}
        />
      )}
    </div>
  );
}