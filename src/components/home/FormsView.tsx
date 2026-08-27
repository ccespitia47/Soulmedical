import { useState } from "react";
import type { ThemeTokens } from "../../context/ThemeContext";
import type { FolderItem, FormItem } from "../../types/folder.types";
import Icon from "../common/Icon";
import EntityIcon from "../common/EntityIcon";
import Avatar from "../common/Avatar";
import FormPopover from "./FormPopover";
import TaskListForForm from "./TaskListForForm";

const ACCENT = "#00c2a8"; // teal de marca del app

type CurrentUser = { name: string; role: string; avatar: string } | null | undefined;

type FormsHeaderProps = {
  folder: FolderItem;
  viewMode: "grid" | "list";
  currentUser: CurrentUser;
  /** Si false, el botón "Nuevo formulario" se oculta. */
  canCreate?: boolean;
  onChangeViewMode: (m: "grid" | "list") => void;
  onCreateForm: () => void;
  onOpenSidebar?: () => void;
};

function FormsHeader({
  folder,
  viewMode,
  currentUser,
  canCreate = true,
  onChangeViewMode,
  onCreateForm,
  onOpenSidebar,
}: FormsHeaderProps) {
  return (
    <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-[22px]">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5">
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            aria-label="Abrir menú"
            className="-ml-1 flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-gray-500 transition hover:bg-slate-100 hover:text-gray-800 lg:hidden"
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: folder.color + "18", color: folder.color }}
        >
          <EntityIcon icon={folder.icon} size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-base font-extrabold tracking-tight text-gray-900">
            {folder.name}
          </h1>
          <div className="mt-0.5 text-[11.5px] text-gray-500">
            {folder.forms.length} formulario{folder.forms.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="hidden gap-0.5 rounded-[7px] bg-slate-100 p-0.5 sm:flex">
          <button
            onClick={() => onChangeViewMode("grid")}
            title="Cuadrícula"
            className="flex cursor-pointer items-center rounded-[5px] border-none px-2 py-1.5"
            style={{
              background: viewMode === "grid" ? "#fff" : "transparent",
              color: viewMode === "grid" ? ACCENT : "#9ca3af",
              boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Icon name="grid" size={14} />
          </button>
          <button
            onClick={() => onChangeViewMode("list")}
            title="Lista"
            className="flex cursor-pointer items-center rounded-[5px] border-none px-2 py-1.5"
            style={{
              background: viewMode === "list" ? "#fff" : "transparent",
              color: viewMode === "list" ? ACCENT : "#9ca3af",
              boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Icon name="list" size={14} />
          </button>
        </div>
        {canCreate && (
          <button
            onClick={onCreateForm}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-2.5 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.65)] sm:px-3.5"
            style={{ background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)" }}
          >
            <Icon name="plus" size={14} />{" "}
            <span className="hidden sm:inline">Nuevo formulario</span>
          </button>
        )}
        {currentUser && (
          <div className="ml-1.5 flex items-center gap-2">
            <Avatar name={currentUser.name} size={26} />
            <span className="hidden text-xs font-semibold text-gray-700 sm:inline">
              {currentUser.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

type FormCardActions = {
  T: ThemeTokens;
  isFav: boolean;
  onToggleFav: () => void;
  /** Undefined → el botón se oculta (sin permiso forms_edit). */
  onEdit?: () => void;
  onDuplicate: () => void;
  onAssign: () => void;
  /** Undefined → el botón se oculta (sin permiso forms_delete). */
  onDelete?: () => void;
  onCreateTask: () => void;
  onShare: () => void;
};

type FormsListProps = {
  folder: FolderItem;
  favorites: string[];
  T: ThemeTokens;
  viewMode: "grid" | "list";
  buildActions: (form: FormItem) => FormCardActions;
  onOpenForm: (folderId: string, formId: string) => void;
  onOpenBuilder: (folderId: string, formId: string) => void;
  onCreateForm: () => void;
};

function FormGrid({
  folder,
  favorites,
  T,
  buildActions,
  onOpenForm,
  onOpenBuilder,
}: Omit<FormsListProps, "viewMode" | "onCreateForm">) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
      {folder.forms.map((form, i) => {
        const isFav = favorites.includes(form.id);
        const actions = buildActions(form);
        return (
          <div
            key={form.id}
            className="animate-fade-up overflow-hidden rounded-xl border-[1.5px] border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]"
            style={{ animationDelay: `${i * 40}ms` }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = "0 14px 30px -10px rgba(0,0,0,0.18)";
              e.currentTarget.style.borderColor = folder.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <div className="h-1" style={{ background: folder.color }} />
            <div className="p-4">
              <div className="mb-2.5 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: folder.color + "14", color: folder.color }}
                  >
                    <Icon name="clipboard" size={24} />
                  </span>
                  {isFav && (
                    <span className="text-amber-500">
                      <Icon name="star" size={14} filled />
                    </span>
                  )}
                </div>
                <FormPopover {...actions} />
              </div>
              <h3 className="m-0 mb-1 text-sm font-bold text-gray-900">{form.name}</h3>
              <p className="mb-3.5 mt-0 text-[11px] text-gray-400">Editado: {form.updatedAt}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onOpenForm(folder.id, form.id)}
                  className="flex-1 cursor-pointer rounded-lg border-none py-2 text-xs font-bold text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105"
                  style={{ background: folder.color }}
                >
                  Diligenciar
                </button>
                <button
                  onClick={() => onOpenBuilder(folder.id, form.id)}
                  className="flex-1 cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent py-2 text-xs font-semibold text-gray-500 transition-all duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 hover:text-gray-700"
                >
                  Config
                </button>
                <button
                  onClick={actions.onCreateTask}
                  title="Crear tarea"
                  aria-label="Crear tarea"
                  className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-slate-200 bg-transparent px-2.5 py-2 text-gray-500 transition-all duration-200 ease-out hover:border-[#00c2a8]/40 hover:bg-[#00c2a8]/5 hover:text-[#0891b2]"
                >
                  <Icon name="clock" size={15} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormList({
  folder,
  favorites,
  T,
  buildActions,
  onOpenForm,
  onOpenBuilder,
  expandedFormId,
  onToggleExpand,
}: Omit<FormsListProps, "viewMode" | "onCreateForm"> & {
  expandedFormId: string | null;
  onToggleExpand: (formId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {folder.forms.map((form, i) => {
        const isFav = favorites.includes(form.id);
        const actions = buildActions(form);
        const isExpanded = expandedFormId === form.id;
        return (
          <div key={form.id}>
            <div
              className="animate-fade-up flex cursor-pointer items-center gap-3.5 rounded-xl border-[1.5px] border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01]"
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => onToggleExpand(form.id)}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 20px -8px rgba(0,0,0,0.14)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
              }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: folder.color + "14", color: folder.color }}
              >
                <Icon name="clipboard" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-gray-900">
                    {form.name}
                  </div>
                  {isFav && (
                    <span className="flex-shrink-0 text-amber-500">
                      <Icon name="star" size={12} filled />
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400">Editado: {form.updatedAt}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenForm(folder.id, form.id);
                  }}
                  className="cursor-pointer rounded-lg border-none px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_3px_10px_-3px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105"
                  style={{ background: folder.color }}
                >
                  Diligenciar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBuilder(folder.id, form.id);
                  }}
                  className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3.5 py-1.5 text-xs font-semibold text-gray-500 transition-all duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 hover:text-gray-700"
                >
                  Config
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onCreateTask();
                  }}
                  title="Crear tarea"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-[1.5px] border-slate-200 bg-transparent px-3 py-1.5 text-xs font-semibold text-gray-500 transition-all duration-200 ease-out hover:border-[#00c2a8]/40 hover:bg-[#00c2a8]/5 hover:text-[#0891b2]"
                >
                  <Icon name="clock" size={13} /> Tarea
                </button>
                <FormPopover {...actions} />
              </div>
            </div>
            {isExpanded && <TaskListForForm formId={form.id} formName={form.name} />}
          </div>
        );
      })}
    </div>
  );
}

type FormsViewProps = {
  folder: FolderItem;
  favorites: string[];
  T: ThemeTokens;
  viewMode: "grid" | "list";
  currentUser: CurrentUser;
  canCreate?: boolean;
  buildActions: (form: FormItem) => FormCardActions;
  onChangeViewMode: (m: "grid" | "list") => void;
  onCreateForm: () => void;
  onOpenForm: (folderId: string, formId: string) => void;
  onOpenBuilder: (folderId: string, formId: string) => void;
  onOpenSidebar?: () => void;
};

export function FormsView({
  folder,
  favorites,
  T,
  viewMode,
  currentUser,
  canCreate = true,
  buildActions,
  onChangeViewMode,
  onCreateForm,
  onOpenForm,
  onOpenBuilder,
  onOpenSidebar,
}: FormsViewProps) {
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#f0f4f8]">
      <FormsHeader
        folder={folder}
        viewMode={viewMode}
        currentUser={currentUser}
        canCreate={canCreate}
        onChangeViewMode={onChangeViewMode}
        onCreateForm={onCreateForm}
        onOpenSidebar={onOpenSidebar}
      />
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {folder.forms.length === 0 ? (
          <div className="animate-fade-up rounded-2xl border-2 border-dashed border-slate-200 px-6 py-20 text-center text-gray-400">
            <span
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: ACCENT + "14", color: ACCENT }}
            >
              <Icon name="inbox" size={32} />
            </span>
            <p className="text-lg font-extrabold tracking-tight text-gray-700">No hay formularios</p>
            {canCreate && (
              <button
                onClick={onCreateForm}
                className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-4 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.65)]"
                style={{ background: "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)" }}
              >
                <Icon name="plus" size={14} /> Crear formulario
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <FormGrid
            folder={folder}
            favorites={favorites}
            T={T}
            buildActions={buildActions}
            onOpenForm={onOpenForm}
            onOpenBuilder={onOpenBuilder}
          />
        ) : (
          <FormList
            folder={folder}
            favorites={favorites}
            T={T}
            buildActions={buildActions}
            onOpenForm={onOpenForm}
            onOpenBuilder={onOpenBuilder}
            expandedFormId={expandedFormId}
            onToggleExpand={(formId) =>
              setExpandedFormId((prev) => (prev === formId ? null : formId))
            }
          />
        )}
      </div>
    </main>
  );
}

export function FormsEmptyState({
  hasProject,
  currentUser,
  onOpenSidebar,
}: {
  hasProject: boolean;
  currentUser: CurrentUser;
  onOpenSidebar?: () => void;
}) {
  return (
    <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#f0f4f8] text-gray-400">
      {onOpenSidebar && (
        <button
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
          className="absolute left-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-gray-500 shadow-sm transition hover:bg-slate-50 hover:text-gray-800 lg:hidden"
        >
          <Icon name="menu" size={20} />
        </button>
      )}
      <span
        className="animate-fade-up flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{ background: ACCENT + "12", color: ACCENT }}
      >
        <Icon name={hasProject ? "folder" : "building"} size={40} />
      </span>
      <p className="animate-fade-up m-0 text-lg font-extrabold tracking-tight text-gray-700">
        {hasProject ? "Selecciona una carpeta" : "Selecciona un proyecto"}
      </p>
      <p className="animate-fade-up m-0 text-[13px]">
        {hasProject
          ? "Elige una carpeta para ver sus formularios"
          : "Elige un proyecto del panel izquierdo"}
      </p>
      {currentUser && (
        <div className="absolute right-5 top-4 flex items-center gap-2">
          <Avatar name={currentUser.name} size={26} />
          <span className="text-xs font-semibold text-gray-700">{currentUser.name}</span>
        </div>
      )}
    </main>
  );
}

export type { FormCardActions };