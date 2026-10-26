import { forwardRef, useCallback, useState } from "react";
import { widgetRegistry } from "../widgets/registry";
import Icon from "../common/Icon";
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
  // Snapshot en vivo de los valores del form — se pasa a los widgets que lo
  // consumen (calc, quiz_score, etc.). Los widgets clásicos son uncontrolled
  // y NO leen esto: se recolectan con FormData en el submit.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const handleFormChange = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    // El `change` del radio/checkbox burbujea ANTES de que React re-renderice
    // los hidden inputs derivados (calc, quiz_question __points). Postergamos
    // 1 frame para leer el FormData después del re-render: sin esto el
    // fieldValues del quiz_score ve puntos viejos y todo sale "incorrecto".
    const form = e.currentTarget;
    requestAnimationFrame(() => {
      if (!form.isConnected) return;
      const fd = new FormData(form);
      const next: Record<string, string> = {};
      fd.forEach((v, k) => {
        next[k] = typeof v === "string" ? v : "";
      });
      setFieldValues(next);
    });
    onChange();
  }, [onChange]);
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="animate-fade-up mx-auto max-w-[680px]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_40px_-12px_rgba(15,45,90,0.18)] ring-1 ring-slate-900/5">
          <div className="h-1.5 w-full bg-[linear-gradient(90deg,#00c2a8_0%,#0891b2_100%)]" />
          <div className="px-6 py-7">
          <div className="mb-6 border-b border-slate-100 pb-[18px]">
            <h2 className="m-0 mb-1.5 text-[24px] font-extrabold tracking-tight text-gray-900">{formName}</h2>
            <p className="m-0 text-[13px] leading-relaxed text-gray-500">
              Completa todos los campos marcados con <span className="font-semibold text-red-500">*</span> y
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
            <form ref={ref} onSubmit={onSubmit} onChange={handleFormChange}>
              <div className="flex flex-col gap-[18px]">
                {widgets.map((widget) => {
                  const RenderComponent = widgetRegistry[widget.type]?.render;
                  const isHidden = hiddenWidgetIds.has(widget.id);
                  if (!RenderComponent) return null;
                  return (
                    // grid-template-rows 1fr/0fr colapsa el widget sin imponer
                    // un tope de altura: los widgets visibles crecen a lo que
                    // necesiten (HTML largo, textos extensos) sin recortarse.
                    <div
                      key={widget.id}
                      className="grid overflow-hidden rounded-xl bg-gray-50 transition-all duration-200 focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_#00c2a8,0_6px_18px_-10px_rgba(8,145,178,0.5)]"
                      style={{
                        gridTemplateRows: isHidden ? "0fr" : "1fr",
                        opacity: isHidden ? 0 : 1,
                        marginBottom: isHidden ? -18 : 0,
                        border: isHidden ? "none" : "1px solid #e5e7eb",
                        pointerEvents: isHidden ? "none" : "auto",
                      }}
                    >
                      {/* min-h-0 permite que el grid item colapse a 0 al ocultar */}
                      <div
                        className="min-h-0 overflow-hidden"
                        style={{ padding: isHidden ? "0 16px" : "16px" }}
                      >
                        <RenderComponent
                          widget={widget}
                          onValue={onWidgetValues}
                          fieldValues={fieldValues}
                          hiddenWidgetIds={hiddenWidgetIds}
                          allWidgets={widgets}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex justify-end gap-3 border-t border-gray-200 pt-5">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-500 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:text-gray-700 hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.35)]"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border-none px-7 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{
                    background: submitting
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #00c2a8 0%, #0891b2 100%)",
                    boxShadow: submitting ? "none" : "0 8px 20px -8px rgba(8,145,178,0.65)",
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin-slow inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={16} strokeWidth={2} />
                      Enviar formulario
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default FormBody;
