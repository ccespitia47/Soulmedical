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
      <p className="m-0 mb-3.5 text-[13px] text-gray-500">
        Define quién debe completar el formulario y en qué orden. Cada persona
        recibe el formulario cuando la anterior termina.
      </p>

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
    </>
  );
}
