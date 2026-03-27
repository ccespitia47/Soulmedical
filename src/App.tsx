import { useState, useEffect } from "react";
import AdminLayout from "./pages/AdminLayout";
import BuilderPage from "./pages/BuilderPage";
import FormPage from "./pages/FormPage";
import UserAppPage from "./pages/UserAppPage";
import Login from "./pages/Login";
import { useFolderStore } from "./store/useFolderStore";
import { getToken, getStoredUser, clearSession } from "./services/api";
import type { AuthUser } from "./types/auth.types";
import { ROLE_PERMISSIONS, ROLE_AVATARS } from "./types/auth.types";

type View = "login" | "admin" | "builder" | "form" | "userapp";

export default function App() {
  const [view, setView] = useState<View>("login");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [currentForm, setCurrentForm] = useState("");
  const { folders } = useFolderStore();

  // Restaurar sesion si hay token guardado
  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      const user: AuthUser = {
        ...stored,
        avatar: ROLE_AVATARS[stored.role as AuthUser["role"]] ?? "👤",
      };
      setCurrentUser(user);
      const perms = ROLE_PERMISSIONS[user.role];
      setView(perms.canManageProjects ? "admin" : "userapp");
    }
  }, []);

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    const perms = ROLE_PERMISSIONS[user.role];
    if (perms.canManageProjects) {
      setView("admin");
    } else {
      setView("userapp");
    }
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setView("login");
  };

  const handleOpenBuilder = (folderId: string, formId: string) => {
    setCurrentFolder(folderId);
    setCurrentForm(formId);
    setView("builder");
  };

  const handleOpenForm = (folderId: string, formId: string) => {
    setCurrentFolder(folderId);
    setCurrentForm(formId);
    setView("form");
  };

  const getFormData = () => {
    const folder = folders.find((f) => f.id === currentFolder);
    const form = folder?.forms.find((fm) => fm.id === currentForm);
    return form;
  };

  const backView: View = currentUser?.role === "admin" ? "admin" : "userapp";

  if (view === "login") return <Login onLogin={handleLogin} />;

  if (view === "builder") return (
    <BuilderPage
      folderId={currentFolder}
      formId={currentForm}
      onBack={() => setView(backView)}
    />
  );

  if (view === "form") {
    const form = getFormData();
    return (
      <FormPage
        formId={currentForm}
        folderId={currentFolder}
        formName={form?.name ?? "Formulario"}
        widgets={form?.widgets ?? []}
        onClose={() => setView(backView)}
      />
    );
  }

  if (view === "userapp") {
    const user = currentUser!;
    return (
      <UserAppPage
        user={user}
        onFillForm={handleOpenForm}
        onLogout={handleLogout}
        onSwitchToAdmin={
          user.role === "admin" ? () => setView("admin") : undefined
        }
      />
    );
  }

  if (view === "admin") {
    const user = currentUser!;
    return (
      <AdminLayout
        currentUser={user}
        onOpenBuilder={handleOpenBuilder}
        onOpenForm={handleOpenForm}
        onSwitchToUserApp={() => setView("userapp")}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}