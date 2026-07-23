import RecipientsInput, { type RecipientUser } from "./RecipientsInput";
import type { EmailRecipient } from "../../../types/email-template.types";

type RecipientsSectionProps = {
  toRecipients: EmailRecipient[];
  ccRecipients: EmailRecipient[];
  bccRecipients: EmailRecipient[];
  allUsers: RecipientUser[];
  hasToError: boolean;
  showCcBcc: boolean;
  onToggleCcBcc: () => void;
  onChangeTo: (r: EmailRecipient[]) => void;
  onChangeCc: (r: EmailRecipient[]) => void;
  onChangeBcc: (r: EmailRecipient[]) => void;
};

export default function RecipientsSection({
  toRecipients,
  ccRecipients,
  bccRecipients,
  allUsers,
  hasToError,
  showCcBcc,
  onToggleCcBcc,
  onChangeTo,
  onChangeCc,
  onChangeBcc,
}: RecipientsSectionProps) {
  const totalTo = toRecipients.length;

  return (
    <div
      className="mb-6 rounded-xl border-2 bg-slate-50 p-5"
      style={{ borderColor: hasToError ? "#fca5a5" : "#e2e8f0" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <h3 className="m-0 text-[15px] font-bold text-gray-900">
            Destinatarios
          </h3>
          {totalTo > 0 && (
            <span className="rounded-[20px] bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#00c2a8]">
              {totalTo} en Para
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCcBcc}
          className="cursor-pointer border-none bg-transparent text-xs font-semibold text-cyan-700"
        >
          {showCcBcc ? "▲ Ocultar CC/BCC" : "▼ Mostrar CC/BCC"}
        </button>
      </div>
      <RecipientsInput
        label="Para (To) *"
        recipients={toRecipients}
        allUsers={allUsers}
        hasError={hasToError}
        onChange={onChangeTo}
      />
      {showCcBcc && (
        <div className="mt-1 grid grid-cols-2 gap-4">
          <RecipientsInput
            label="CC (opcional)"
            recipients={ccRecipients}
            allUsers={allUsers}
            onChange={onChangeCc}
          />
          <RecipientsInput
            label="BCC (opcional)"
            recipients={bccRecipients}
            allUsers={allUsers}
            onChange={onChangeBcc}
          />
        </div>
      )}
    </div>
  );
}
