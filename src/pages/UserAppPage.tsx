import { useState, useEffect } from "react";
import { useFolderStore } from "../store/useFolderStore";
import { useProjectStore } from "../store/useProjectStore";
import { useAuthStore } from "../store/useAuthStore";
import { getMyTasksApi, getMySubmissionsApi } from "../services/api";
import { listDrafts } from "../utils/formDrafts";
import MyTasksList from "../components/userapp/MyTasksList";
import MySubmissionsList from "../components/userapp/MySubmissionsList";
import MyDraftsList from "../components/userapp/MyDraftsList";
import MyTwoFactorButton from "../components/auth/MyTwoFactorButton";
import Icon from "../components/common/Icon";
import EntityIcon from "../components/common/EntityIcon";
import Avatar from "../components/common/Avatar";
import type { AuthUser } from "../types/auth.types";

type AppSection = "forms" | "tasks" | "drafts" | "sent";

// Usamos Pick para aceptar tanto AuthUser como AppUser
type UserForApp = Pick<AuthUser, "name" | "role" | "avatar" | "assignments"> & { id?: number; email?: string };

type UserAppPageProps = {
  user: UserForApp;
  onFillForm: (folderId: string, formId: string) => void;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
};

export default function UserAppPage({ user, onFillForm, onLogout, onSwitchToAdmin }: UserAppPageProps) {
  const { folders, loadFolders } = useFolderStore();
  const { projects, loadProjects } = useProjectStore();

  const { currentUser } = useAuthStore();
  const [section, setSection] = useState<AppSection>("forms");
  const [pendingCount, setPendingCount] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  // Drawer del sidebar en móvil (en escritorio siempre visible).
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Contadores para los badges del sidebar.
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      // Tareas pendientes (mi turno)
      const tasksRes = await getMyTasksApi();
      if (cancelled) return;
      const mineTasks = (tasksRes.data ?? []).filter(
        (t) => t.myStatus === "in_progress",
      );
      setPendingCount(mineTasks.length);

      // Borradores en localStorage (por usuario)
      if (currentUser?.id) {
        setDraftsCount(listDrafts(currentUser.id).length);
      }

      // Envíos hechos por el usuario
      const subsRes = await getMySubmissionsApi(1, 1);
      if (cancelled) return;
      setSentCount(subsRes.data?.total ?? 0);
    };
    loadCounts();
    const handler = () => {
      if (!document.hidden) loadCounts();
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handler);
    };
  }, [section, currentUser?.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadFolders(selectedProjectId);
    }
  }, [selectedProjectId, loadFolders]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // El backend ya filtra los formularios según las asignaciones del usuario
  const getVisibleFolders = () => {
    return folders
      .filter((f) => f.projectId === selectedProjectId && f.forms.length > 0);
  };

  const visibleFolders = getVisibleFolders();

  const filteredFolders = visibleFolders
    .map((folder) => ({
      ...folder,
      forms: folder.forms.filter((form) =>
        search.trim() === "" || form.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((folder) => folder.forms.length > 0 || search.trim() === "");

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const totalForms = visibleFolders.reduce((acc, f) => acc + f.forms.length, 0);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-['Segoe_UI',sans-serif]">

      {/* Backdrop móvil/tablet */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar oscuro estilo MoreApp ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[212px] flex-shrink-0 flex-col bg-[#1e293b] transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="border-b border-white/[0.08] px-5 pb-4 pt-5">
          <span className="inline-flex items-center rounded-lg px-2 py-1.5" style={{ background: "#0F1623" }}>
            <img src="/soulforms-logo-dark.png" alt="SoulForms" className="h-5 object-contain" />
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5">
          {[
            { id: "forms" as AppSection, icon: "clipboard", label: "Formularios", badge: 0 },
            { id: "tasks" as AppSection, icon: "checkCircle", label: "Tareas", badge: pendingCount },
            { id: "drafts" as AppSection, icon: "edit", label: "Borradores", badge: draftsCount },
            { id: "sent" as AppSection, icon: "send", label: "Enviados", badge: sentCount },
          ].map((item) => {
            const active = section === item.id;
            return (
              <div
                key={item.label}
                onClick={() => { setSection(item.id); setSidebarOpen(false); }}
                className={`group mb-1 flex cursor-pointer items-center gap-3 rounded-lg border-l-[3px] px-3.5 py-2.5 transition-all duration-200 ease-out ${
                  active
                    ? "border-[#00c2a8] bg-gradient-to-br from-[#00c2a8]/25 to-[#0891b2]/15 shadow-[0_4px_14px_-6px_rgba(0,194,168,0.5)]"
                    : "border-transparent hover:bg-white/[0.06]"
                }`}
              >
                <Icon name={item.icon} size={18} className={active ? "text-[#2dd4bf]" : "text-white/45 transition-colors group-hover:text-white/70"} />
                <span className={`flex-1 text-[13px] ${active ? "font-bold text-[#2dd4bf]" : "font-normal text-white/50 transition-colors group-hover:text-white/70"}`}>
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <span className="min-w-[18px] rounded-[10px] bg-red-500 px-1.5 py-px text-center text-[10px] font-bold text-white shadow-[0_2px_6px_-1px_rgba(239,68,68,0.5)]">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}

          {/* Botón volver al admin (solo si es admin) */}
          {onSwitchToAdmin && (
            <>
              <div className="mx-2 my-3 h-px bg-white/[0.08]" />
              <div
                onClick={onSwitchToAdmin}
                className="group flex cursor-pointer items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3.5 py-2.5 transition-all duration-200 ease-out hover:bg-white/[0.06]"
              >
                <Icon name="settings" size={18} className="text-white/45 transition-colors group-hover:text-white/70" />
                <span className="text-[13px] text-white/50 transition-colors group-hover:text-white/70">Panel Admin</span>
              </div>
            </>
          )}
        </nav>

        {/* Footer usuario */}
        <div className="border-t border-white/[0.08] px-3 py-3.5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <Avatar name={user.name} size={34} />
            <div className="min-w-0">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-white">
                {user.name}
              </div>
              <div className="text-[10px] capitalize text-white/40">
                {user.role.replace("_", " ")}
              </div>
            </div>
          </div>
          <MyTwoFactorButton
            className="mb-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          />
          <button
            onClick={onLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-red-500/20 hover:shadow-[0_8px_18px_-8px_rgba(239,68,68,0.6)]"
          >
            <Icon name="logout" size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col lg:ml-[212px]">

        {/* Header */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              className="-ml-1 flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="min-w-0">
            <h1 className="m-0 truncate text-lg font-extrabold tracking-tight text-[#0f172a] sm:text-xl">
              {section === "forms"
                ? "Formularios"
                : section === "tasks"
                ? "Tareas"
                : section === "drafts"
                ? "Borradores"
                : "Enviados"}
            </h1>
            {section === "forms" && selectedProject && (
              <p className="m-0 text-xs text-slate-400">
                {selectedProject.name} · {totalForms} formulario{totalForms !== 1 ? "s" : ""}
              </p>
            )}
            {section === "tasks" && (
              <p className="m-0 text-xs text-slate-400">
                {pendingCount} tarea{pendingCount !== 1 ? "s" : ""} pendiente
                {pendingCount !== 1 ? "s" : ""}
              </p>
            )}
            {section === "drafts" && (
              <p className="m-0 text-xs text-slate-400">
                {draftsCount} borrador{draftsCount !== 1 ? "es" : ""} guardado
                {draftsCount !== 1 ? "s" : ""}
              </p>
            )}
            {section === "sent" && (
              <p className="m-0 text-xs text-slate-400">
                {sentCount} envío{sentCount !== 1 ? "s" : ""} en total
              </p>
            )}
            </div>
          </div>

          {section === "forms" && projects.length > 1 && (
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-shrink-0 cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-3 py-1.5 font-[inherit] text-[13px] text-slate-700 outline-none transition-colors focus:border-[#00c2a8]"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </header>

        {section === "tasks" ? (
          <MyTasksList />
        ) : section === "drafts" ? (
          <MyDraftsList onContinue={onFillForm} />
        ) : section === "sent" ? (
          <MySubmissionsList />
        ) : (
          <>
        {/* Buscador */}
        <div className="border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6">
          <div className="relative max-w-[400px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              placeholder="Busca carpetas y formularios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 font-[inherit] text-[13px] text-[#0f172a] outline-none transition-colors focus:border-[#00c2a8] focus:bg-white"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="animate-fade-up flex-1 overflow-y-auto px-4 py-4 sm:px-6">

          {projects.length === 0 || totalForms === 0 ? (
            <div className="animate-fade-up px-6 py-20 text-center text-slate-400">
              <span className="mb-4 flex justify-center text-slate-300">
                <Icon name="inbox" size={48} />
              </span>
              <p className="text-[15px] font-semibold">No hay formularios disponibles</p>
              <p className="text-[13px]">
                {user.role === "user"
                  ? "El administrador aún no te ha asignado formularios."
                  : "Contacta al administrador para asignarte formularios."}
              </p>
            </div>
          ) : (
            filteredFolders.map((folder, i) => {
              const isExpanded = expandedFolders.has(folder.id);
              return (
                <div key={folder.id} className="animate-fade-up mb-2.5" style={{ animationDelay: `${i * 40}ms` }}>
                  {/* Carpeta */}
                  <div
                    onClick={() => toggleFolder(folder.id)}
                    className={`flex cursor-pointer items-center justify-between border border-slate-200 bg-white px-[18px] py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.005] hover:shadow-[0_10px_24px_-10px_rgba(15,23,42,0.18)] ${isExpanded ? "rounded-t-xl" : "rounded-xl"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: folder.color + "1f", color: folder.color }}
                      >
                        <EntityIcon icon={folder.icon} size={18} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[#0f172a]">{folder.name}</div>
                        <div className="text-[11px] text-slate-400">{folder.forms.length} formulario{folder.forms.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span className="inline-block text-slate-400 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                      <Icon name="chevronRight" size={16} />
                    </span>
                  </div>

                  {/* Formularios */}
                  {isExpanded && (
                    <div className="overflow-hidden rounded-b-xl border border-t-0 border-slate-200">
                      {folder.forms.map((form, index) => (
                        <div
                          key={form.id}
                          onClick={() => onFillForm(folder.id, form.id)}
                          className={`group flex cursor-pointer items-center justify-between bg-white px-[18px] py-3 transition-colors duration-150 ease-out hover:bg-[#f0fdf4] ${index > 0 ? "border-t border-slate-100" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg"
                              style={{ background: `${folder.color}18`, color: folder.color }}
                            >
                              <Icon name="clipboard" size={16} />
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-[#0f172a]">{form.name}</div>
                              <div className="text-[11px] text-slate-400">Editado: {form.updatedAt}</div>
                            </div>
                          </div>
                          <span className="text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[#00c2a8]">
                            <Icon name="chevronRight" size={16} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {search.trim() !== "" && filteredFolders.every((f) => f.forms.length === 0) && (
            <div className="animate-fade-up px-6 py-16 text-center text-slate-400">
              <span className="flex justify-center text-slate-300">
                <Icon name="search" size={40} />
              </span>
              <p className="mt-3 text-sm">Sin resultados para "<strong>{search}</strong>"</p>
            </div>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
