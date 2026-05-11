import { create } from "zustand";
import { persist } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import type { WidgetInstance } from "../types/widget.types";
import { widgetRegistry } from "../components/widgets/registry";

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
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
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
            id: crypto.randomUUID(),
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
    }),
    { name: "soulforms-builder" }
  )
);