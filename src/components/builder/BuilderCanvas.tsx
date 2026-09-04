import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useState } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useFolderStore } from "../../store/useFolderStore";
import { widgetRegistry } from "../widgets/registry";
import type { WidgetInstance } from "../../types/widget.types";
import Icon from "../common/Icon";
import WidgetActionMenu from "./WidgetActionMenu";
import {
  cloneRulesForNewWidget,
  writeClipboard,
} from "../../lib/widgetClone";

function SortableItem({ widget, folderId, formId }: {
  widget: WidgetInstance;
  folderId?: string;
  formId?: string;
}) {
  const { removeWidget, selectWidget, selectedWidgetId, duplicateWidget } = useBuilderStore();
  const { folders, saveFormRules } = useFolderStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelected = widget.id === selectedWidgetId;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    background: "#ffffff",
    border: isSelected ? "2px solid #00c2a8" : "1.5px solid #e2e8f0",
    borderRadius: 10,
    marginBottom: 10,
    boxShadow: isSelected
      ? "0 0 0 3px rgba(0,194,168,0.15)"
      : "0 1px 3px rgba(0,0,0,0.08)",
    cursor: "pointer",
    overflow: "visible",
  };

  const Preview = widgetRegistry[widget.type]?.preview;

  // Helpers para leer las rules del form actual desde el folder store.
  const currentRules = (() => {
    if (!folderId || !formId) return [];
    const folder = folders.find((f) => f.id === folderId);
    const form = folder?.forms.find((fm) => fm.id === formId);
    return form?.rules ?? [];
  })();

  const handleDuplicate = (withRules: boolean) => {
    const result = duplicateWidget(widget.id);
    if (!result) return;
    if (withRules && folderId && formId) {
      const clones = cloneRulesForNewWidget(currentRules, result.oldId, result.newId);
      if (clones.length > 0) {
        void saveFormRules(folderId, formId, [...currentRules, ...clones]);
      }
    }
  };

  const handleCopy = (withRules: boolean) => {
    // Al copiar, si "con reglas": guardamos las rules donde el widget original
    // aparezca, SIN remapear (se guardan con el id original del widget).
    // Al pegar en otro form, el remapping y filtrado ocurre allá.
    const rulesForClipboard = withRules
      ? currentRules.filter(
          (r) =>
            r.conditions.some((c) => c.widgetId === widget.id) ||
            r.targetWidgetIds.includes(widget.id),
        )
      : [];
    writeClipboard({
      widget,
      rules: rulesForClipboard,
      sourceFormId: formId ?? null,
      copiedAt: Date.now(),
    });
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => selectWidget(widget.id)}>
      {/* Handle de arrastre */}
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          cursor: "grab",
          fontSize: 11,
          color: "#9ca3af",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <span>⠿</span>
        <span>Arrastrar para reordenar</span>
      </div>

      {/* Preview del widget */}
      {Preview ? (
        <Preview widget={widget} />
      ) : (
        <p style={{ padding: 12, fontSize: 14, color: "#9ca3af" }}>Sin preview</p>
      )}

      {/* Botón ⋮ (menú de acciones) */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        style={{
          position: "absolute", top: 4, right: 34,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, color: "#9ca3af", width: 24, height: 24,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = "#0f172a"; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
        aria-label="Acciones del widget"
        title="Duplicar / Copiar"
      >
        ⋮
      </button>

      {/* Botón eliminar */}
      <button
        onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
        style={{
          position: "absolute", top: 4, right: 8,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: "#9ca3af", width: 24, height: 24,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseOver={(e) => { (e.target as HTMLElement).style.color = "#ef4444"; }}
        onMouseOut={(e) => { (e.target as HTMLElement).style.color = "#9ca3af"; }}
      >
        ✕
      </button>

      {menuOpen && (
        <WidgetActionMenu
          onDuplicate={() => handleDuplicate(false)}
          onDuplicateWithRules={() => handleDuplicate(true)}
          onCopy={() => handleCopy(false)}
          onCopyWithRules={() => handleCopy(true)}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default function BuilderCanvas({ folderId, formId }: {
  folderId?: string;
  formId?: string;
}) {
  const { widgets, moveWidget, clearSelection } = useBuilderStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = widgets.findIndex((w) => w.id === active.id);
    const to = widgets.findIndex((w) => w.id === over.id);
    if (from !== -1 && to !== -1) moveWidget(from, to);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }} onClick={clearSelection}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a", margin: 0 }}>
          Tu formulario
        </h2>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, fontWeight: 600, color: "#64748b", background: "#f1f5f9",
          padding: "3px 9px", borderRadius: 20, border: "1px solid #e2e8f0",
        }}>
          <Icon name="clipboard" size={12} />
          {widgets.length} campo{widgets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Canvas vacío */}
      {widgets.length === 0 && (
        <div className="animate-fade-up" style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "60px 24px",
          border: "2px dashed #e2e8f0", borderRadius: 20,
          background: "rgba(255,255,255,0.5)",
          textAlign: "center", color: "#94a3b8",
        }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 64, width: 64, borderRadius: 20, background: "rgba(0,194,168,0.1)", color: "#00c2a8" }}>
            <Icon name="clipboard" size={30} />
          </span>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#334155", margin: 0 }}>Agrega campos desde el panel de widgets</p>
          <span style={{ fontSize: 12 }}>En móvil usa el botón de abajo</span>
        </div>
      )}

      {/* Lista de widgets */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div onClick={(e) => e.stopPropagation()}>
            {widgets.map((widget) => (
              <SortableItem key={widget.id} widget={widget} folderId={folderId} formId={formId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}