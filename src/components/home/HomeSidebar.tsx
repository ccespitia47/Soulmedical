import { useState } from "react";
import { useTheme, type Theme, type Density } from "../../context/ThemeContext";
import type { FolderItem } from "../../types/folder.types";
import type { RecentEntry } from "../../hooks/useHomePersistence";
import Icon from "../common/Icon";
import QuickPanel from "./QuickPanel";
import ProjectRow, { type ProjectRowProps } from "./ProjectRow";

const ACCENT = "#00c2a8";

type Project = ProjectRowProps["project"];

type HomeSidebarProps = {
  projects: Project[];
  pinnedProjects: Project[];
  unpinnedProjects: Project[];
  folders: FolderItem[];
  recents: RecentEntry[];
  favorites: string[];
  buildProjectRowProps: (p: Project) => ProjectRowProps;
  onCreateProject: () => void;
  onNavigateToForm: (folderId: string, formId: string) => void;
};

export default function HomeSidebar({
  projects,
  pinnedProjects,
  unpinnedProjects,
  folders,
  recents,
  favorites,
  buildProjectRowProps,
  onCreateProject,
  onNavigateToForm,
}: HomeSidebarProps) {
  const { theme, density, T, setTheme, setDensity } = useTheme();
  const [quickMode, setQuickMode] = useState<"recents" | "favorites" | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside
      className="flex w-[300px] flex-shrink-0 flex-col border-r"
      style={{ background: T.bg, color: T.text, borderColor: T.border }}
    >
      <div className="relative px-3.5 pb-2.5 pt-3.5">
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs"
          style={{ background: T.inputBg, borderColor: T.inputBorder, color: T.placeholder }}
        >
          <Icon name="search" size={14} />
          <span className="flex-1">Buscar o saltar a…</span>
          <span
            className="rounded font-mono text-[10px] font-semibold"
            style={{ color: T.kbdText, background: T.kbdBg, padding: "2px 6px" }}
          >
            ⌘K
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          {(["recents", "favorites"] as const).map((m) => {
            const active = quickMode === m;
            return (
              <button
                key={m}
                onClick={() => setQuickMode(active ? null : m)}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border py-[7px] font-sans text-xs font-medium transition-all"
                style={{
                  borderColor: active ? ACCENT : T.border,
                  background: active ? ACCENT + "18" : T.bgElev,
                  color: active ? ACCENT : T.text,
                }}
                onMouseOver={(e) => {
                  if (!active) e.currentTarget.style.background = T.bgHover;
                }}
                onMouseOut={(e) => {
                  if (!active) e.currentTarget.style.background = T.bgElev;
                }}
              >
                <Icon name={m === "recents" ? "clock" : "star"} size={13} />
                {m === "recents" ? "Recientes" : "Favoritos"}
                {m === "favorites" && favorites.length > 0 && (
                  <span
                    className="min-w-[14px] rounded-[10px] text-center text-[9px] font-bold text-white"
                    style={{ background: ACCENT, padding: "0 4px" }}
                  >
                    {favorites.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {quickMode && (
          <QuickPanel
            mode={quickMode}
            T={T}
            recents={recents}
            favorites={favorites}
            folders={folders}
            onNavigate={onNavigateToForm}
            onClose={() => setQuickMode(null)}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {pinnedProjects.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-2">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.08em]"
                style={{ color: T.label }}
              >
                📌 Anclados
              </span>
            </div>
            {pinnedProjects.map((p) => (
              <ProjectRow key={p.id} {...buildProjectRowProps(p)} />
            ))}
            <div className="mx-1.5 my-2 h-px" style={{ background: T.nestBorder }} />
          </>
        )}

        <div className="flex items-center justify-between px-1.5 pb-1 pt-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.08em]"
            style={{ color: T.label }}
          >
            {pinnedProjects.length > 0 ? "Todos los proyectos" : "Proyectos"}
          </span>
          <button
            onClick={onCreateProject}
            title="Nuevo proyecto"
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border-none bg-transparent"
            style={{ color: T.textMuted }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = T.bgElev;
              e.currentTarget.style.color = T.text;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            <Icon name="plus" size={13} />
          </button>
        </div>
        {projects.length === 0 ? (
          <div
            className="px-3 py-5 text-center text-xs"
            style={{ color: T.textMuted }}
          >
            No hay proyectos. Crea uno con +.
          </div>
        ) : (
          unpinnedProjects.map((p) => <ProjectRow key={p.id} {...buildProjectRowProps(p)} />)
        )}
      </div>

      <div
        className="flex items-center gap-2 border-t px-3.5 py-2.5"
        style={{ borderColor: T.border }}
      >
        <div
          className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-extrabold"
          style={{ background: ACCENT + "28", color: ACCENT }}
        >
          S
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-bold leading-tight"
            style={{ color: T.textStrong }}
          >
            Grupo Soul
          </div>
          <div className="text-[10px]" style={{ color: T.textMuted }}>
            Workspace
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSettings((o) => !o)}
            title="Ajustes"
            className="flex cursor-pointer items-center justify-center rounded-md border-none p-1"
            style={{
              background: showSettings ? T.bgHover : "transparent",
              color: showSettings ? ACCENT : T.textMuted,
            }}
          >
            <Icon name="settings" size={14} />
          </button>
          {showSettings && (
            <div
              className="absolute bottom-[calc(100%+8px)] right-0 z-[100] min-w-[200px] rounded-[10px] border p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
              style={{ background: T.bgElev, borderColor: T.border }}
            >
              <p
                className="m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ color: T.label }}
              >
                Apariencia
              </p>
              <div
                className="mb-3 flex gap-0.5 rounded-[7px] p-0.5"
                style={{ background: T.bg }}
              >
                {(["light", "dark", "midnight"] as Theme[]).map((t) => {
                  const active = theme === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className="flex flex-1 cursor-pointer flex-col items-center gap-[3px] rounded-[5px] border-none px-1 py-1.5 font-sans text-[13px] transition-all"
                      style={{
                        background: active ? ACCENT : "transparent",
                        color: active ? "#fff" : T.textMuted,
                      }}
                    >
                      <span>{t === "light" ? "☀️" : t === "dark" ? "🌙" : "🌌"}</span>
                      <span className="text-[9px] font-semibold">
                        {t === "light" ? "Claro" : t === "dark" ? "Oscuro" : "Noche"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p
                className="m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ color: T.label }}
              >
                Densidad
              </p>
              <div
                className="flex gap-0.5 rounded-[7px] p-0.5"
                style={{ background: T.bg }}
              >
                {(["compact", "regular", "comfy"] as Density[]).map((d) => {
                  const active = density === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className="flex flex-1 cursor-pointer flex-col items-center gap-[3px] rounded-[5px] border-none px-1 py-1.5 font-sans transition-all"
                      style={{
                        background: active ? ACCENT : "transparent",
                        color: active ? "#fff" : T.textMuted,
                      }}
                    >
                      <span className="text-[11px] font-bold">
                        {d === "compact" ? "S" : d === "regular" ? "M" : "L"}
                      </span>
                      <span className="text-[9px] font-semibold">
                        {d === "compact" ? "Compacto" : d === "regular" ? "Normal" : "Espacioso"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
