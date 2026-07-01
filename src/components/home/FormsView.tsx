import type { ThemeTokens } from "../../context/ThemeContext";
import type { FolderItem, FormItem } from "../../types/folder.types";
import Icon from "../common/Icon";
import FormPopover from "./FormPopover";

const ACCENT = "#00c2a8";

type CurrentUser = { name: string; role: string; avatar: string } | null | undefined;

type FormsHeaderProps = {
  folder: FolderItem;
  viewMode: "grid" | "list";
  currentUser: CurrentUser;
  onChangeViewMode: (m: "grid" | "list") => void;
  onCreateForm: () => void;
};

function FormsHeader({
  folder,
  viewMode,
  currentUser,
  onChangeViewMode,
  onCreateForm,
}: FormsHeaderProps) {
  return (
    <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-[22px]">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[9px] text-lg"
          style={{ background: ACCENT + "14", color: ACCENT }}
        >
          {folder.icon}
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
        <div className="flex gap-0.5 rounded-[7px] bg-slate-100 p-0.5">
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
        <button
          onClick={onCreateForm}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none px-3.5 py-2 text-[13px] font-semibold text-white"
          style={{ background: ACCENT }}
        >
          <Icon name="plus" size={14} /> Nuevo formulario
        </button>
        {currentUser && (
          <div className="ml-1.5 flex items-center gap-1.5">
            <span className="text-sm">{currentUser.avatar}</span>
            <span className="text-xs font-semibold text-gray-700">{currentUser.name}</span>
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
  onEdit: () => void;
  onDuplicate: () => void;
  onAssign: () => void;
  onDelete: () => void;
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
      {folder.forms.map((form) => {
        const isFav = favorites.includes(form.id);
        const actions = buildActions(form);
        return (
          <div
            key={form.id}
            className="overflow-hidden rounded-xl border-[1.5px] border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all"
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
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
                  <span className="text-[28px]">📋</span>
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
                  className="flex-1 cursor-pointer rounded-[7px] border-none py-2 text-xs font-bold text-white"
                  style={{ background: folder.color }}
                >
                  Diligenciar
                </button>
                <button
                  onClick={() => onOpenBuilder(folder.id, form.id)}
                  className="flex-1 cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-transparent py-2 text-xs font-semibold text-gray-500"
                >
                  Config
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
}: Omit<FormsListProps, "viewMode" | "onCreateForm">) {
  return (
    <div className="flex flex-col gap-1.5">
      {folder.forms.map((form) => {
        const isFav = favorites.includes(form.id);
        const actions = buildActions(form);
        return (
          <div
            key={form.id}
            className="flex items-center gap-3.5 rounded-[10px] border-[1.5px] border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all"
            style={{ borderLeft: `4px solid ${folder.color}` }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.08)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
            }}
          >
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
              style={{ background: folder.color + "14", color: folder.color }}
            >
              📋
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
                onClick={() => onOpenForm(folder.id, form.id)}
                className="cursor-pointer rounded-[7px] border-none px-3.5 py-1.5 text-xs font-bold text-white"
                style={{ background: folder.color }}
              >
                Diligenciar
              </button>
              <button
                onClick={() => onOpenBuilder(folder.id, form.id)}
                className="cursor-pointer rounded-[7px] border-[1.5px] border-slate-200 bg-transparent px-3.5 py-1.5 text-xs font-semibold text-gray-500"
              >
                Config
              </button>
              <FormPopover {...actions} />
            </div>
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
  buildActions: (form: FormItem) => FormCardActions;
  onChangeViewMode: (m: "grid" | "list") => void;
  onCreateForm: () => void;
  onOpenForm: (folderId: string, formId: string) => void;
  onOpenBuilder: (folderId: string, formId: string) => void;
};

export function FormsView({
  folder,
  favorites,
  T,
  viewMode,
  currentUser,
  buildActions,
  onChangeViewMode,
  onCreateForm,
  onOpenForm,
  onOpenBuilder,
}: FormsViewProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#f0f4f8]">
      <FormsHeader
        folder={folder}
        viewMode={viewMode}
        currentUser={currentUser}
        onChangeViewMode={onChangeViewMode}
        onCreateForm={onCreateForm}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {folder.forms.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-20 text-center text-gray-400">
            <span className="mb-3 block text-5xl">📋</span>
            <p className="text-[15px] font-semibold">No hay formularios</p>
            <button
              onClick={onCreateForm}
              className="mt-3 cursor-pointer rounded-lg border-none px-3.5 py-2 text-[13px] font-semibold text-white"
              style={{ background: ACCENT }}
            >
              Crear formulario
            </button>
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
          />
        )}
      </div>
    </main>
  );
}

export function FormsEmptyState({
  hasProject,
  currentUser,
}: {
  hasProject: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#f0f4f8] text-gray-400">
      <span className="text-[56px]">{hasProject ? "📁" : "🏢"}</span>
      <p className="m-0 text-[15px] font-semibold text-gray-700">
        {hasProject ? "Selecciona una carpeta" : "Selecciona un proyecto"}
      </p>
      <p className="m-0 text-[13px]">
        {hasProject
          ? "Elige una carpeta para ver sus formularios"
          : "Elige un proyecto del panel izquierdo"}
      </p>
      {currentUser && (
        <div className="absolute right-5 top-4 flex items-center gap-1.5">
          <span className="text-sm">{currentUser.avatar}</span>
          <span className="text-xs font-semibold text-gray-700">{currentUser.name}</span>
        </div>
      )}
    </main>
  );
}
