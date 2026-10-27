import { useEffect } from "react";
import { useBuilderStore } from "../../store/useBuilderStore";
import { useUsersStore } from "../../store/useUsersStore";
import { useEmailConfig } from "./emailConfig/useEmailConfig";
import EmailConfigItem from "./emailConfig/EmailConfigItem";
import { buildPlaceholders } from "../../utils/placeholders";
import Icon from "../common/Icon";

type EmailConfigPanelProps = {
  folderId?: string;
  formId?: string;
  onClose: () => void;
};

export default function EmailConfigPanel({
  folderId,
  formId,
  onClose,
}: EmailConfigPanelProps) {
  const widgets = useBuilderStore((s) => s.widgets);
  const { users, loadUsers, loaded: usersLoaded } = useUsersStore();

  useEffect(() => {
    if (!usersLoaded) loadUsers();
  }, [usersLoaded, loadUsers]);

  const {
    configs,
    expandedId,
    validationErrorsById,
    addConfig,
    removeConfig,
    updateConfig,
    replaceConfig,
    toggleExpanded,
    clearErrorContaining,
    save,
  } = useEmailConfig(folderId, formId);

  // Placeholders disponibles (widgets + subcampos) para interpolación en
  // asunto, cuerpo y nombre del PDF.
  const widgetPlaceholders = buildPlaceholders(widgets);

  // Campos elegibles como fuente de email (destinatarios tipo field/lookup).
  const ELIGIBLE_FIELD_TYPES = new Set([
    "email",
    "text",
    "select",
    "phone",
    "number",
    "search",
    "radio",
    "date",
  ]);
  const emailFields = widgets
    .filter((w) => ELIGIBLE_FIELD_TYPES.has(w.type))
    .map((w) => ({
      id: w.id,
      label:
        w.label ||
        (w.config?.placeholder as string | undefined) ||
        w.id,
    }));

  const handleSave = () => {
    if (save()) onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      <div className="animate-modal-in flex max-h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_-18px_rgba(15,40,80,0.45)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] text-white shadow-[0_8px_20px_-6px_rgba(0,194,168,0.6)]">
              <Icon name="mail" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-[22px] font-extrabold tracking-tight text-slate-900">
                Configuración de email
              </h2>
              <p className="m-0 mt-0.5 text-[12.5px] text-gray-400">
                Agregá una o más notificaciones de email que se dispararán
                al enviarse el formulario. Cada una tiene sus propios
                destinatarios, cuerpo y PDF.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border-none bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-6">
          {configs.map((cfg, i) => (
            <EmailConfigItem
              key={cfg.id ?? `tpl-${i}`}
              config={cfg}
              index={i}
              total={configs.length}
              expanded={expandedId === (cfg.id ?? `tpl-${i}`)}
              onToggleExpanded={() => toggleExpanded(cfg.id ?? `tpl-${i}`)}
              onChange={(partial) => updateConfig(cfg.id ?? `tpl-${i}`, partial)}
              onReplace={(updater) => replaceConfig(cfg.id ?? `tpl-${i}`, updater)}
              onDelete={() => removeConfig(cfg.id ?? `tpl-${i}`)}
              widgets={widgets}
              users={users}
              emailFields={emailFields}
              widgetPlaceholders={widgetPlaceholders}
              validationErrors={validationErrorsById[cfg.id ?? `tpl-${i}`] ?? []}
              clearErrorContaining={(substr) =>
                clearErrorContaining(cfg.id ?? `tpl-${i}`, substr)
              }
            />
          ))}

          <button
            type="button"
            onClick={addConfig}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-500 transition-all hover:border-[#00c2a8] hover:bg-emerald-50/40 hover:text-[#00c2a8]"
          >
            <Icon name="plus" size={16} /> Agregar notificación
          </button>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border-[1.5px] border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8_0%,#0891b2_100%)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(0,194,168,0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,194,168,0.6)]"
          >
            <Icon name="save" size={16} /> Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}
