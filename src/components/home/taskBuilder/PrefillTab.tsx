import { forwardRef } from "react";
import { widgetRegistry } from "../../widgets/registry";
import type { WidgetInstance } from "../../../types/widget.types";

type PrefillTabProps = {
  widgets: WidgetInstance[];
  /** Ids ocultos por reglas de visibilidad: no se muestran (igual que la vista
   *  del destinatario), para prellenar solo lo que realmente verá. */
  hiddenWidgetIds?: Set<string>;
  onChange: () => void;
  /** Un widget (search) puede rellenar otros campos tras una selección. */
  onWidgetValues?: (values: Record<string, string>) => void;
};

const PrefillTab = forwardRef<HTMLFormElement, PrefillTabProps>(function PrefillTab(
  { widgets, hiddenWidgetIds, onChange, onWidgetValues },
  ref,
) {
  const visibleWidgets = widgets.filter((w) => !hiddenWidgetIds?.has(w.id));
  return (
    <>
      <p className="m-0 mb-4 text-[13px] text-gray-500">
        Completa los campos que ya conoces. Los campos en blanco los llenará el
        destinatario.
      </p>
      {widgets.length === 0 ? (
        <div className="rounded-[10px] border-[1.5px] border-dashed border-slate-300 bg-slate-50 p-7 text-center text-gray-400">
          Este formulario no tiene campos
        </div>
      ) : (
        <form
          ref={ref}
          onChange={onChange}
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-3.5">
            {visibleWidgets.map((widget) => {
              const RenderComponent = widgetRegistry[widget.type]?.render;
              if (!RenderComponent) return null;
              return (
                <div
                  key={widget.id}
                  className="rounded-[10px] border border-gray-200 bg-slate-50 px-4 py-3.5"
                >
                  <RenderComponent widget={widget} onValue={onWidgetValues} />
                </div>
              );
            })}
          </div>
        </form>
      )}
    </>
  );
});

export default PrefillTab;
