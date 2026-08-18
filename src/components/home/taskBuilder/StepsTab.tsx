import type { GroupData } from "../../../services/api";
import StepCard from "./StepCard";
import type { Recipient, SimpleUser, Step } from "./types";

type StepsTabProps = {
  steps: Step[];
  allUsers: SimpleUser[];
  groups: GroupData[];
  /** stepNumber → labels de las firmas asignadas a ese paso. */
  signaturesByStep?: Map<number, string[]>;
  showDropdown: Record<string, boolean>;
  onAddStep: () => void;
  onRemoveStep: (id: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onChangeStepEmail: (id: string, email: string, name: string) => void;
  onSetShowDropdown: (id: string, show: boolean) => void;
  onSelectStepUser: (id: string, recipient: Recipient) => void;
  onAddGroupMembers: (id: string, group: GroupData) => void;
  shareEnabled?: boolean;
  onShareEnabledChange?: (v: boolean) => void;
  disabled?: boolean;
  shareCheckboxDisabled?: boolean;
  shareCheckboxKey?: number;
  shareLinkUrl?: string | null;
  oneShotLink?: boolean;
  onOneShotLinkChange?: (v: boolean) => void;
};

export default function StepsTab({
  steps,
  allUsers,
  groups,
  signaturesByStep,
  showDropdown,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onChangeStepEmail,
  onSetShowDropdown,
  onSelectStepUser,
  onAddGroupMembers,
  shareEnabled = false,
  onShareEnabledChange,
  disabled = false,
  shareCheckboxDisabled = false,
  shareCheckboxKey = 0,
  shareLinkUrl = null,
  oneShotLink = false,
  onOneShotLinkChange,
}: StepsTabProps) {
  const getFiltered = (stepId: string): SimpleUser[] => {
    const q = (steps.find((s) => s.id === stepId)?.inputEmail || "").toLowerCase();
    if (!q) return allUsers.slice(0, 6);
    return allUsers
      .filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  };

  return (
    <>
      <div className="mb-4 rounded-[10px] border-[1.5px] border-blue-200 bg-blue-50 p-3.5">
        {/* El checkbox del enlace compartible es editable incluso post-create.
            Antes de crear: actualiza el estado local.
            Después de crear: llama al API para toggle del link.
            Se deshabilita solo durante la operación (linkBusy). */}
        <label
          className={`flex items-start gap-2.5 ${shareCheckboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <input
            key={`share-cbx-${shareCheckboxKey}`}
            type="checkbox"
            checked={shareEnabled}
            disabled={shareCheckboxDisabled}
            onChange={(e) => onShareEnabledChange?.(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
          />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-blue-900">
              🔗 Generar enlace compartible
            </div>
            <div className="mt-0.5 text-[11.5px] text-blue-700">
              Además de los destinatarios por correo, genera un link único que
              podrás copiar y pegar en WhatsApp, chat o donde quieras. Cada
              llenado del link crea un registro nuevo. Útil para personas sin
              correo electrónico.
            </div>
          </div>
        </label>

        {shareEnabled && (
          <label
            className={`ml-6 mt-2 flex items-center gap-2 text-[12px] ${
              shareCheckboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={oneShotLink ?? false}
              disabled={shareCheckboxDisabled}
              onChange={(e) => onOneShotLinkChange?.(e.target.checked)}
            />
            <span>
              Solo permitir un llenado por link
              <span className="ml-1 text-[10.5px] text-slate-500">
                (Tras el primer submit el enlace deja de funcionar.)
              </span>
            </span>
          </label>
        )}
      </div>

      {disabled && !shareLinkUrl && shareEnabled && (
        <div className="mt-3 rounded-[10px] border-[1.5px] border-dashed border-slate-300 bg-slate-50 p-3.5 text-[12px] text-gray-500">
          Primero haz clic en <strong>Crear tarea</strong> para generar el enlace.
        </div>
      )}

      {shareLinkUrl && (
        <div className="mt-3 rounded-[10px] border-[1.5px] border-emerald-200 bg-emerald-50 p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              ✓
            </div>
            <div>
              <div className="text-[13px] font-bold text-emerald-900">Enlace listo</div>
              <div className="text-[11.5px] text-emerald-700">
                Cópialo y compártelo por WhatsApp, chat o donde quieras.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareLinkUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2 font-mono text-[11.5px] text-gray-900"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLinkUrl);
                } catch (err) {
                  console.error('clipboard error:', err);
                }
              }}
              className="cursor-pointer rounded-lg border-none bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white"
            >
              📋 Copiar
            </button>
          </div>
        </div>
      )}

      <p className="m-0 mb-3.5 mt-3.5 text-[13px] text-gray-500">
        Define quién debe completar el formulario y en qué orden. Cada persona
        recibe el formulario cuando la anterior termina.
      </p>

      <fieldset
        disabled={disabled}
        className={disabled ? 'opacity-50 [&_input]:cursor-not-allowed [&_button]:cursor-not-allowed [&_select]:cursor-not-allowed' : ''}
      >
        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            index={idx}
            total={steps.length}
            assignedSignatures={signaturesByStep?.get(idx + 1) ?? []}
            showDropdown={!!showDropdown[step.id]}
            filteredUsers={getFiltered(step.id)}
            groups={groups}
            onMove={onMoveStep}
            onRemove={onRemoveStep}
            onChangeEmail={onChangeStepEmail}
            onSetShowDropdown={onSetShowDropdown}
            onSelectUser={onSelectStepUser}
            onAddGroupMembers={onAddGroupMembers}
          />
        ))}

        <button
          onClick={onAddStep}
          className="mt-1 w-full cursor-pointer rounded-lg border-[1.5px] border-dashed border-[#00c2a8] bg-transparent px-2.5 py-2.5 text-[13px] font-bold text-[#00c2a8]"
        >
          + Agregar otro destinatario
        </button>

        {steps.length > 1 && (
          <div className="mt-3.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-900">
            ⚡ Los destinatarios recibirán el formulario en el orden definido — uno
            a la vez.
          </div>
        )}
      </fieldset>
    </>
  );
}
