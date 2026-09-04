import { create } from "zustand";
import { persist } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import type { WidgetInstance } from "../types/widget.types";
import { widgetRegistry } from "../components/widgets/registry";
import { randomUUID } from "../utils/uuid";
import { cloneWidgetWithNewId } from "../lib/widgetClone";

interface BuilderState {
  widgets: WidgetInstance[];
  selectedWidgetId: string | null;
  // Guarda qué formId está cargado actualmente en el builder
  currentFormId: string | null;

  addWidget: (type: string) => void;
  removeWidget: (id: string) => void;
  selectWidget: (id: string | null) => void;
  updateWidget: (id: string, changes: Partial<WidgetInstance>) => void;
  moveWidget: (fromIndex: number, toIndex: number) => void;
  clearSelection: () => void;
  setWidgets: (widgets: WidgetInstance[], formId?: string) => void;
  clearWidgets: () => void;
  duplicateWidget: (id: string) => { newId: string; oldId: string } | null;
  insertWidget: (widget: WidgetInstance) => void;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      widgets: [],
      selectedWidgetId: null,
      currentFormId: null,

      setWidgets: (widgets, formId) =>
        set({ widgets, currentFormId: formId ?? null }),

      clearWidgets: () =>
        set({ widgets: [], selectedWidgetId: null, currentFormId: null }),

      addWidget: (type) =>
        set((state) => {
          const def = widgetRegistry[type];
          if (!def) return state;
          const newWidget: WidgetInstance = {
            id: randomUUID(),
            type,
            label: def.label,
            required: false,
            config: { ...def.defaultConfig },
          };
          return {
            widgets: [...state.widgets, newWidget],
            selectedWidgetId: newWidget.id,
          };
        }),

      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
          selectedWidgetId:
            state.selectedWidgetId === id ? null : state.selectedWidgetId,
        })),

      selectWidget: (id) => set({ selectedWidgetId: id }),

      clearSelection: () => set({ selectedWidgetId: null }),

      updateWidget: (id, changes) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, ...changes } : w
          ),
        })),

      moveWidget: (fromIndex, toIndex) =>
        set((state) => ({
          widgets: arrayMove(state.widgets, fromIndex, toIndex),
        })),

      duplicateWidget: (id) => {
        const state = get();
        const idx = state.widgets.findIndex((w) => w.id === id);
        if (idx === -1) return null;
        const source = state.widgets[idx];
        const { widget: cloned, newId } = cloneWidgetWithNewId(source);
        const next = [...state.widgets];
        next.splice(idx + 1, 0, cloned);
        set({ widgets: next, selectedWidgetId: newId });
        return { newId, oldId: id };
      },

      insertWidget: (widget) =>
        set((state) => ({
          widgets: [...state.widgets, widget],
          selectedWidgetId: widget.id,
        })),
    }),
    { name: "soulforms-builder" }
  )
);