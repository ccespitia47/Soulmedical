import { useState } from "react";
import type { WidgetPropertiesProps } from "../../../types/widget.types";
import type { SubformField, SubformRule } from "./subform.types";
import SubformBuilderModal from "./builder/SubformBuilderModal";

const INPUT_CLASS =
  "box-border w-full rounded-[7px] border-[1.5px] border-slate-200 bg-neutral-50 px-3 py-2 font-sans text-[13.5px] text-gray-900 outline-none focus:border-[#00c2a8]";

const SMALL_INPUT_CLASS =
  "box-border w-full rounded-[7px] border-[1.5px] border-slate-200 bg-neutral-50 px-2.5 py-2 font-sans text-[13px] text-gray-900 outline-none focus:border-[#00c2a8]";

const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500";

export default function SubformProperties({
  widget,
  updateWidget,
}: WidgetPropertiesProps) {
  const fields = (widget.config.fields as SubformField[]) || [];
  const rules = (widget.config.rules as SubformRule[]) || [];
  const [showModal, setShowModal] = useState(false);

  const handleSave = (newFields: SubformField[], newRules: SubformRule[]) => {
    updateWidget(widget.id, {
      config: { ...widget.config, fields: newFields, rules: newRules },
    });
    setShowModal(false);
  };

  const setConfig = (changes: Record<string, unknown>) => {
    updateWidget(widget.id, { config: { ...widget.config, ...changes } });
  };

  return (
    <>
      <div className="mb-3.5">
        <label className={LABEL_CLASS}>Etiqueta</label>
        <input
          className={INPUT_CLASS}
          value={widget.label}
          onChange={(e) => updateWidget(widget.id, { label: e.target.value })}
        />
      </div>

      <div className="mb-3.5">
        <label className={LABEL_CLASS}>Texto del botón agregar</label>
        <input
          className={INPUT_CLASS}
          value={(widget.config.addButtonLabel as string) || "Agregar"}
          onChange={(e) => setConfig({ addButtonLabel: e.target.value })}
        />
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLASS}>Mín. entradas</label>
          <input
            type="number"
            min={0}
            className={SMALL_INPUT_CLASS}
            value={(widget.config.minEntries as number) || 0}
            onChange={(e) =>
              setConfig({ minEntries: parseInt(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Máx. (0=∞)</label>
          <input
            type="number"
            min={0}
            className={SMALL_INPUT_CLASS}
            value={(widget.config.maxEntries as number) || 0}
            onChange={(e) =>
              setConfig({ maxEntries: parseInt(e.target.value) || 0 })
            }
          />
        </div>
      </div>

      <label className="mb-5 flex cursor-pointer items-center gap-2 text-[13px] text-gray-900">
        <input
          type="checkbox"
          checked={widget.required}
          onChange={(e) => updateWidget(widget.id, { required: e.target.checked })}
        />
        <span>Obligatorio (al menos una entrada)</span>
      </label>

      <div className="border-t border-slate-200 pt-3.5">
        <div className="mb-2.5 flex gap-2">
          <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
            <div className="text-lg font-extrabold text-emerald-600">
              {fields.length}
            </div>
            <div className="text-[11px] text-gray-500">Campos</div>
          </div>
          <div className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center">
            <div className="text-lg font-extrabold text-violet-600">
              {rules.length}
            </div>
            <div className="text-[11px] text-gray-500">Reglas</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full cursor-pointer rounded-lg border-none bg-gradient-to-br from-[#00c2a8] to-[#0891b2] px-2.5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(0,194,168,0.3)]"
        >
          🗂️ Configurar campos y reglas
        </button>
      </div>

      {showModal && (
        <SubformBuilderModal
          widgetLabel={widget.label}
          fields={fields}
          rules={rules}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
