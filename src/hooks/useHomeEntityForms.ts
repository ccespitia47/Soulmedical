import { useState } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";

/**
 * Maneja el estado de los modales de crear/editar proyecto/carpeta/formulario.
 * Mantiene los inputs (name/color/icon) y los handlers de submit.
 */
export function useHomeEntityForms() {
  const { addFolder, updateFolder, addForm, renameForm, selectedFolderId } =
    useFolderStore();
  const { addProject, updateProject, selectedProjectId } = useProjectStore();
  const folders = useFolderStore((s) => s.folders);
  const projects = useProjectStore((s) => s.projects);

  // Modales abiertos
  const [showNewProject, setShowNewProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingForm, setEditingForm] = useState<{
    folderId: string;
    formId: string;
    formName: string;
  } | null>(null);
  const [editFormName, setEditFormName] = useState("");

  // Inputs
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#00c2a8");
  const [folderIcon, setFolderIcon] = useState("📁");
  const [newFormName, setNewFormName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState("#00c2a8");
  const [projectIcon, setProjectIcon] = useState("🏢");

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    addProject(projectName.trim(), projectColor, projectIcon);
    setProjectName("");
    setProjectColor("#00c2a8");
    setProjectIcon("🏢");
    setShowNewProject(false);
  };

  const handleOpenEditProject = (id: string) => {
    const p = projects.find((p) => p.id === id);
    if (!p) return;
    setProjectName(p.name);
    setProjectColor(p.color);
    setProjectIcon(p.icon);
    setEditingProjectId(id);
    setShowEditProject(true);
  };

  const handleSaveEditProject = () => {
    if (!editingProjectId || !projectName.trim()) return;
    updateProject(editingProjectId, {
      name: projectName,
      color: projectColor,
      icon: projectIcon,
    });
    setShowEditProject(false);
    setEditingProjectId(null);
  };

  const handleCreateFolder = () => {
    if (!folderName.trim() || !selectedProjectId) return;
    addFolder(folderName.trim(), folderColor, folderIcon, selectedProjectId);
    setFolderName("");
    setFolderColor("#00c2a8");
    setFolderIcon("📁");
    setShowNewFolder(false);
  };

  const handleOpenEditFolder = (id: string) => {
    const f = folders.find((f) => f.id === id);
    if (!f) return;
    setFolderName(f.name);
    setFolderColor(f.color);
    setFolderIcon(f.icon);
    setEditingFolder(id);
    setShowEditFolder(true);
  };

  const handleSaveEditFolder = () => {
    if (!editingFolder || !folderName.trim()) return;
    updateFolder(editingFolder, {
      name: folderName,
      color: folderColor,
      icon: folderIcon,
    });
    setShowEditFolder(false);
    setEditingFolder(null);
  };

  const handleCreateForm = () => {
    if (!newFormName.trim() || !selectedFolderId) return;
    addForm(selectedFolderId, newFormName.trim());
    setNewFormName("");
    setShowNewForm(false);
  };

  const handleSubmitEditForm = () => {
    if (editingForm && editFormName.trim()) {
      renameForm(editingForm.folderId, editingForm.formId, editFormName.trim());
    }
    setEditingForm(null);
  };

  return {
    // Modales (show)
    showNewProject,
    setShowNewProject,
    showEditProject,
    setShowEditProject,
    showNewFolder,
    setShowNewFolder,
    showEditFolder,
    setShowEditFolder,
    showNewForm,
    setShowNewForm,
    editingForm,
    setEditingForm,
    editFormName,
    setEditFormName,

    // Inputs
    folderName,
    setFolderName,
    folderColor,
    setFolderColor,
    folderIcon,
    setFolderIcon,
    newFormName,
    setNewFormName,
    projectName,
    setProjectName,
    projectColor,
    setProjectColor,
    projectIcon,
    setProjectIcon,

    // Handlers
    handleCreateProject,
    handleOpenEditProject,
    handleSaveEditProject,
    handleCreateFolder,
    handleOpenEditFolder,
    handleSaveEditFolder,
    handleCreateForm,
    handleSubmitEditForm,
  };
}
