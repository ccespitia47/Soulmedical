import { forwardRef } from "react";
import { widgetRegistry } from "../widgets/registry";
import type { WidgetInstance } from "../../types/widget.types";

type FormBodyProps = {
  formName: string;
  widgets: WidgetInstance[];
  hiddenWidgetIds: Set<string>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: () => void;
  onCancel?: () => void;
  // Callback que algunos widgets (ej. search) invocan para rellenar
  // otros campos del formulario tras una selección del usuario.
  onWidgetValues?: (values: Record<string, string>) => void;
};

const FormBody = forwardRef<HTMLFormElement, FormBodyProps>(function FormBody(
  { formName, widgets, hiddenWidgetIds, submitting, onSubmit, onChange, onCancel, onWidgetValues },
  ref
) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="rounded-2xl bg-white px-6 py-7 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <div className="mb-6 border-b-2 border-[#00c2a8] pb-[18px]">
            <h2 className="m-0 mb-1.5 text-[22px] font-bold text-gray-900">{formName}</h2>
            <p className="m-0 text-[13px] text-gray-500">
              Completa todos los campos marcados con <span className="text-red-500">*</span> y
              envía el formulario.
            </p>
          </div>

          {widgets.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 px-5 py-14 text-center text-gray-400">
              <span className="text-5xl">📋</span>
              <p className="mt-4 text-[15px] font-semibold">
                Este formulario no tiene campos
              </p>
            </div>
          ) : (
            <form ref={ref} onSubmit={onSubmit} onChange={onChange}>
              <div className="flex flex-col gap-[18px]">
                {widgets.map((widget) => {
                  const RenderComponent = widgetRegistry[widget.type]?.render;
                  const isHidden = hiddenWidgetIds.has(widget.id);
                  if (!RenderComponent) return null;
                  return (
                    <div
                      key={widget.id}
                      className="overflow-hidden rounded-[10px] bg-gray-50 transition-all duration-200"
                      style={{
                        maxHeight: isHidden ? 0 : 600,
                        opacity: isHidden ? 0 : 1,
                        padding: isHidden ? "0 16px" : "16px",
                        marginBottom: isHidden ? -18 : 0,
                        border: isHidden ? "none" : "1px solid #e5e7eb",
                        pointerEvents: isHidden ? "none" : "auto",
                      }}
                    >
                      <RenderComponent widget={widget} onValue={onWidgetValues} />
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex justify-end gap-3 border-t border-gray-200 pt-5">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-transparent px-6 py-2.5 text-sm font-semibold text-gray-500"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border-none px-7 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed"
                  style={{
                    background: submitting ? "#94a3b8" : "#00c2a8",
                    boxShadow: submitting ? "none" : "0 2px 8px rgba(0,194,168,0.3)",
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin-slow inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" />
                      Enviando...
                    </>
                  ) : (
                    "📤 Enviar formulario"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
});

export default FormBody;
