import ConfirmModal from "../common/ConfirmModal";
import EntityFormModal from "../common/EntityFormModal";
import RenameModal from "../common/RenameModal";
import AssignUsersModal from "./AssignUsersModal";
import CreateTaskModal from "./CreateTaskModal";
import {
  FOLDER_COLORS,
  FOLDER_ICONS,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "../../types/folder.types";
import type { UserApiData } from "../../services/api";
import type { AssignTarget } from "../../hooks/useHomeAssignTarget";
import type { FormRule, WidgetInstance } from "../../types/widget.types";

type ConfirmFormState = {
  folderId: string;
  formId: string;
  formName: string;
} | null;

type ConfirmFolderState = {
  folderId: string;
  folderName: string;
} | null;

type ConfirmProjectState = {
  projectId: string;
  projectName: string;
} | null;

type TaskFormState = {
  formId: string;
  folderId: string;
  formName: string;
  widgets: WidgetInstance[];
  rules: FormRule[];
} | null;

type HomeModalsProps = {
  // Entity forms
  showNewProject: boolean;
  showEditProject: boolean;
  showNewFolder: boolean;
  showEditFolder: boolean;
  showNewForm: boolean;
  editingForm: { folderId: string; formId: string; formName: string } | null;
  editFormName: string;

  projectName: string;
  projectColor: string;
  projectIcon: string;
  folderName: string;
  folderColor: string;
  folderIcon: string;
  newFormName: string;

  onChangeProjectName: (v: string) => void;
  onChangeProjectColor: (v: string) => void;
  onChangeProjectIcon: (v: string) => void;
  onChangeFolderName: (v: string) => void;
  onChangeFolderColor: (v: string) => void;
  onChangeFolderIcon: (v: string) => void;
  onChangeNewFormName: (v: string) => void;
  onChangeEditFormName: (v: string) => void;

  onCreateProject: () => void;
  onSaveEditProject: () => void;
  onCreateFolder: () => void;
  onSaveEditFolder: () => void;
  onCreateForm: () => void;
  onSubmitEditForm: () => void;

  onCloseNewProject: () => void;
  onCloseEditProject: () => void;
  onCloseNewFolder: () => void;
  onCloseEditFolder: () => void;
  onCloseNewForm: () => void;
  onCloseEditForm: () => void;

  // Asignación
  assignTarget: AssignTarget | null;
  allUsers: UserApiData[];
  assignedUserIds: Set<number>;
  loadingAssign: boolean;
  savingAssign: boolean;
  onToggleUser: (id: number) => void;
  onSaveAssignments: () => void;
  onCloseAssign: () => void;

  // Confirmaciones
  confirmDelete: ConfirmFormState;
  confirmDuplicate: ConfirmFormState;
  confirmDeleteFolder: ConfirmFolderState;
  confirmDuplicateFolder: ConfirmFolderState;
  confirmDeleteProject: ConfirmProjectState;
  onConfirmDelete: () => void;
  onConfirmDuplicate: () => void;
  onConfirmDeleteFolder: () => void;
  onConfirmDuplicateFolder: () => void;
  onConfirmDeleteProject: () => void;
  onCancelDelete: () => void;
  onCancelDuplicate: () => void;
  onCancelDeleteFolder: () => void;
  onCancelDuplicateFolder: () => void;
  onCancelDeleteProject: () => void;

  // Task
  taskForm: TaskFormState;
  onCloseTask: () => void;
};

export default function HomeModals(props: HomeModalsProps) {
  return (
    <>
      {props.showNewProject && (
        <EntityFormModal
          title="Nuevo Proyecto"
          submitLabel="Crear proyecto"
          placeholder="Ej: Contabilidad"
          name={props.projectName}
          color={props.projectColor}
          icon={props.projectIcon}
          colors={PROJECT_COLORS}
          icons={PROJECT_ICONS}
          onChangeName={props.onChangeProjectName}
          onChangeColor={props.onChangeProjectColor}
          onChangeIcon={props.onChangeProjectIcon}
          onSubmit={props.onCreateProject}
          onClose={props.onCloseNewProject}
        />
      )}
      {props.showEditProject && (
        <EntityFormModal
          title="Editar Proyecto"
          submitLabel="Guardar cambios"
          name={props.projectName}
          color={props.projectColor}
          icon={props.projectIcon}
          colors={PROJECT_COLORS}
          icons={PROJECT_ICONS}
          onChangeName={props.onChangeProjectName}
          onChangeColor={props.onChangeProjectColor}
          onChangeIcon={props.onChangeProjectIcon}
          onSubmit={props.onSaveEditProject}
          onClose={props.onCloseEditProject}
        />
      )}
      {props.showNewFolder && (
        <EntityFormModal
          title="Nueva Carpeta"
          submitLabel="Crear carpeta"
          placeholder="Ej: Formularios de salud"
          name={props.folderName}
          color={props.folderColor}
          icon={props.folderIcon}
          colors={FOLDER_COLORS}
          icons={FOLDER_ICONS}
          onChangeName={props.onChangeFolderName}
          onChangeColor={props.onChangeFolderColor}
          onChangeIcon={props.onChangeFolderIcon}
          onSubmit={props.onCreateFolder}
          onClose={props.onCloseNewFolder}
        />
      )}
      {props.showEditFolder && (
        <EntityFormModal
          title="Editar Carpeta"
          submitLabel="Guardar cambios"
          name={props.folderName}
          color={props.folderColor}
          icon={props.folderIcon}
          colors={FOLDER_COLORS}
          icons={FOLDER_ICONS}
          onChangeName={props.onChangeFolderName}
          onChangeColor={props.onChangeFolderColor}
          onChangeIcon={props.onChangeFolderIcon}
          onSubmit={props.onSaveEditFolder}
          onClose={props.onCloseEditFolder}
        />
      )}
      {props.showNewForm && (
        <RenameModal
          title="Nuevo Formulario"
          submitLabel="Crear formulario"
          placeholder="Ej: Registro de pacientes"
          value={props.newFormName}
          onChange={props.onChangeNewFormName}
          onSubmit={props.onCreateForm}
          onClose={props.onCloseNewForm}
        />
      )}
      {props.editingForm && (
        <RenameModal
          title="Editar Formulario"
          submitLabel="Guardar"
          value={props.editFormName}
          onChange={props.onChangeEditFormName}
          onSubmit={props.onSubmitEditForm}
          onClose={props.onCloseEditForm}
        />
      )}
      {props.assignTarget && (
        <AssignUsersModal
          title={
            props.assignTarget.kind === "form"
              ? "👥 Asignar Usuarios al Formulario"
              : "👥 Asignar Usuarios al Proyecto"
          }
          subtitle={`${props.assignTarget.name} · Selecciona quiénes pueden ver este ${
            props.assignTarget.kind === "form" ? "formulario" : "proyecto"
          }`}
          users={props.allUsers}
          userIds={props.assignedUserIds}
          loading={props.loadingAssign}
          saving={props.savingAssign}
          onToggle={props.onToggleUser}
          onSave={props.onSaveAssignments}
          onClose={props.onCloseAssign}
        />
      )}

      {props.confirmDelete && (
        <ConfirmModal
          title="¿Eliminar formulario?"
          message={`Eliminarás "<strong>${props.confirmDelete.formName}</strong>".`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
        />
      )}
      {props.confirmDuplicate && (
        <ConfirmModal
          title="¿Duplicar formulario?"
          message={`Se creará una copia de "<strong>${props.confirmDuplicate.formName}</strong>".`}
          confirmLabel="Duplicar"
          confirmColor="#3b82f6"
          onCancel={props.onCancelDuplicate}
          onConfirm={props.onConfirmDuplicate}
        />
      )}
      {props.confirmDeleteFolder && (
        <ConfirmModal
          title="¿Eliminar carpeta?"
          message={`Eliminarás "<strong>${props.confirmDeleteFolder.folderName}</strong>" y todos sus formularios.`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={props.onCancelDeleteFolder}
          onConfirm={props.onConfirmDeleteFolder}
        />
      )}
      {props.confirmDuplicateFolder && (
        <ConfirmModal
          title="¿Duplicar carpeta?"
          message={`Se duplicará "<strong>${props.confirmDuplicateFolder.folderName}</strong>".`}
          confirmLabel="Duplicar"
          confirmColor="#3b82f6"
          onCancel={props.onCancelDuplicateFolder}
          onConfirm={props.onConfirmDuplicateFolder}
        />
      )}
      {props.confirmDeleteProject && (
        <ConfirmModal
          title="¿Eliminar proyecto?"
          message={`Eliminarás "<strong>${props.confirmDeleteProject.projectName}</strong>" y todo su contenido.`}
          confirmLabel="Eliminar"
          confirmColor="#ef4444"
          onCancel={props.onCancelDeleteProject}
          onConfirm={props.onConfirmDeleteProject}
        />
      )}

      {props.taskForm && (
        <CreateTaskModal
          formId={props.taskForm.formId}
          folderId={props.taskForm.folderId}
          formName={props.taskForm.formName}
          widgets={props.taskForm.widgets}
          rules={props.taskForm.rules}
          onClose={props.onCloseTask}
          onCreated={props.onCloseTask}
        />
      )}
    </>
  );
}
