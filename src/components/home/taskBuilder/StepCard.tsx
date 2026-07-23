import type { GroupData } from "../../../services/api";
import {
  TASK_INPUT_CLASS,
  TASK_LABEL_CLASS,
  type Recipient,
  type SimpleUser,
  type Step,
} from "./types";

type StepCardProps = {
  step: Step;
  index: number;
  total: number;
  /** Etiquetas de las firmas del formulario asignadas a este paso. */
  assignedSignatures?: string[];
  showDropdown: boolean;
  filteredUsers: SimpleUser[];
  groups: GroupData[];
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onChangeEmail: (id: string, email: string, name: string) => void;
  onSetShowDropdown: (id: string, show: boolean) => void;
  onSelectUser: (id: string, recipient: Recipient) => void;
  onAddGroupMembers: (id: string, group: GroupData) => void;
};

function SourceBadge({ source }: { source: Recipient["source"] }) {
  const cfg = {
    user: { bg: "#e6faf7", color: "#059669", label: "👤 Usuario" },
    group: { bg: "#ede9fe", color: "#7c3aed", label: "👥 Grupo" },
    external: { bg: "#fef3c7", color: "#92400e", label: "🌐 Externo" },
  }[source];
  return (
    <span
      className="rounded-[20px] px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function RecipientDropdown({
  users,
  groups,
  onSelectUser,
  onAddGroupMembers,
}: {
  users: SimpleUser[];
  groups: GroupData[];
  onSelectUser: (recipient: Recipient) => void;
  onAddGroupMembers: (group: GroupData) => void;
}) {
  const hasUsers = users.length > 0;
  const hasGroups = groups.length > 0;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-[10px] border-[1.5px] border-slate-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      {hasUsers && (
        <>
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase text-gray-400">
            👤 Usuarios
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              onMouseDown={() =>
                onSelectUser({
                  id: String(u.id),
                  email: u.email,
                  name: u.name,
                  source: "user",
                })
              }
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-emerald-50"
            >
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-[13px] font-bold text-white">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-900">
                  {u.name}
                </div>
                <div className="text-[11px] text-gray-400">{u.email}</div>
              </div>
            </div>
          ))}
        </>
      )}
      {hasGroups && (
        <>
          <div
            className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase text-gray-400"
            style={{
              borderTop: hasUsers ? "1px solid #f1f5f9" : "none",
            }}
          >
            👥 Grupos
          </div>
          {groups.map((g) => (
            <div
              key={g.id}
              onMouseDown={() => onAddGroupMembers(g)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-emerald-50"
            >
              <div
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-base"
                style={{ background: (g.color || "#00c2a8") + "20" }}
              >
                {g.icon || "👥"}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-900">
                  {g.name}
                </div>
                <div className="text-[11px] text-gray-400">
                  Agregar todos los miembros
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {!hasUsers && !hasGroups && (
        <div className="p-4 text-center text-xs text-gray-400">
          Sin resultados
        </div>
      )}
    </div>
  );
}

export default function StepCard({
  step,
  index,
  total,
  assignedSignatures = [],
  showDropdown,
  filteredUsers,
  groups,
  onMove,
  onRemove,
  onChangeEmail,
  onSetShowDropdown,
  onSelectUser,
  onAddGroupMembers,
}: StepCardProps) {
  const titleText =
    index === 0
      ? "Primer destinatario"
      : index === total - 1
      ? "Último destinatario"
      : `Destinatario ${index + 1}`;

  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  return (
    <div className="mb-3 rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-4 py-3.5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-[#00c2a8] text-xs font-bold text-white">
          {index + 1}
        </div>
        <span className="flex-1 text-[13px] font-bold text-gray-900">
          {titleText}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onMove(step.id, -1)}
            disabled={!canMoveUp}
            className="border-none bg-transparent text-xs text-gray-500 disabled:opacity-30"
            style={{ cursor: canMoveUp ? "pointer" : "default" }}
          >
            ▲
          </button>
          <button
            onClick={() => onMove(step.id, 1)}
            disabled={!canMoveDown}
            className="border-none bg-transparent text-xs text-gray-500 disabled:opacity-30"
            style={{ cursor: canMoveDown ? "pointer" : "default" }}
          >
            ▼
          </button>
          {total > 1 && (
            <button
              onClick={() => onRemove(step.id)}
              className="cursor-pointer border-none bg-transparent text-sm text-red-300"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className={`${TASK_LABEL_CLASS} mb-1`}>Email *</label>
            <input
              type="email"
              value={step.inputEmail}
              placeholder="email@ejemplo.com"
              onChange={(e) => {
                onChangeEmail(step.id, e.target.value, step.inputName);
                onSetShowDropdown(step.id, true);
              }}
              onFocus={() => onSetShowDropdown(step.id, true)}
              onBlur={() =>
                setTimeout(() => onSetShowDropdown(step.id, false), 200)
              }
              className={TASK_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={`${TASK_LABEL_CLASS} mb-1`}>Nombre</label>
            <input
              value={step.inputName}
              placeholder="Nombre del destinatario"
              onChange={(e) =>
                onChangeEmail(step.id, step.inputEmail, e.target.value)
              }
              className={TASK_INPUT_CLASS}
            />
          </div>
        </div>

        {showDropdown && (
          <RecipientDropdown
            users={filteredUsers}
            groups={groups}
            onSelectUser={(r) => onSelectUser(step.id, r)}
            onAddGroupMembers={(g) => onAddGroupMembers(step.id, g)}
          />
        )}
      </div>

      {step.recipient && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <SourceBadge source={step.recipient.source} />
        </div>
      )}

      {assignedSignatures.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[12px] text-emerald-800">
          <span className="mt-px text-base leading-none">🖊️</span>
          <div className="leading-snug">
            <strong>Esta persona firmará:</strong>{" "}
            {assignedSignatures.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
