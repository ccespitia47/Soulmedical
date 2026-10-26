import { useMemo, useRef, useState } from "react";
import type { GroupData } from "../../../services/api";
import EntityIcon from "../../common/EntityIcon";
import ExcelEmailUploader from "../../common/ExcelEmailUploader";
import {
  TASK_LABEL_CLASS,
  type SimpleUser,
  type Step,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  onSetEmails: (id: string, emails: string[]) => void;
  onSetShowDropdown: (id: string, show: boolean) => void;
  onAddUser: (id: string, user: SimpleUser) => void;
  onAddGroupMembers: (id: string, group: GroupData) => void;
};

function RecipientDropdown({
  users,
  groups,
  onSelectUser,
  onAddGroupMembers,
}: {
  users: SimpleUser[];
  groups: GroupData[];
  onSelectUser: (user: SimpleUser) => void;
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
              onMouseDown={() => onSelectUser(u)}
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
            style={{ borderTop: hasUsers ? "1px solid #f1f5f9" : "none" }}
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
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: (g.color || "#00c2a8") + "20", color: g.color || "#00c2a8" }}
              >
                <EntityIcon icon={g.icon} size={16} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gray-900">
                  {g.name}
                </div>
                <div className="text-[11px] text-gray-400">
                  Agrega todos los miembros en paralelo
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
  onSetEmails,
  onSetShowDropdown,
  onAddUser,
  onAddGroupMembers,
}: StepCardProps) {
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const titleText =
    index === 0
      ? "Primer destinatario"
      : index === total - 1
      ? "Último destinatario"
      : `Destinatario ${index + 1}`;

  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  const flashHint = (msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 3000);
  };

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      flashHint(`"${raw}" no es un email válido`);
      return;
    }
    if (step.emails.some((e) => e.toLowerCase() === email)) {
      flashHint(`${email} ya está en la lista`);
      return;
    }
    onSetEmails(step.id, [...step.emails, email]);
    setTyped("");
    inputRef.current?.focus();
  };

  const removeChipAt = (idx: number) => {
    onSetEmails(
      step.id,
      step.emails.filter((_, i) => i !== idx),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && typed.trim()) {
      e.preventDefault();
      addEmail(typed.replace(/,$/, ""));
    }
    if (e.key === "Backspace" && typed === "" && step.emails.length > 0) {
      removeChipAt(step.emails.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    if (/[,\n\r;\s]/.test(pasted)) {
      e.preventDefault();
      const parts = pasted.split(/[,\n\r;\s]+/).filter(Boolean);
      for (const p of parts) addEmail(p);
    }
  };

  const parallelCount = step.emails.length;
  // El buscador reacciona al texto tipeado aunque ya haya chips. `filteredUsers`
  // viene del padre con TODOS los usuarios disponibles (sin recortar): aquí
  // filtramos por lo que se escribe y RECIÉN AHÍ recortamos a 6 sugerencias.
  // Antes el padre recortaba a 6 y el filtro por texto solo veía esos 6 →
  // un usuario buscado por nombre nunca aparecía si no estaba en el slice
  // inicial.
  const q = typed.trim().toLowerCase();
  const matched = q
    ? filteredUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q),
      )
    : filteredUsers;
  const searchedUsers = matched.slice(0, 6);
  const dropdownVisible =
    showDropdown && (searchedUsers.length > 0 || groups.length > 0);
  const nameFor = (email: string) => step.namesByEmail[email];

  const displayChips = useMemo(
    () =>
      step.emails.map((email, idx) => ({
        email,
        idx,
        display: nameFor(email) ? `${nameFor(email)} · ${email}` : email,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step.emails, step.namesByEmail],
  );

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

      <label className={`${TASK_LABEL_CLASS} mb-1`}>Emails *</label>
      <div className="relative">
        <div
          className="flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-1.5"
          onClick={() => {
            inputRef.current?.focus();
            onSetShowDropdown(step.id, true);
          }}
        >
          {displayChips.map((c) => (
            <span
              key={`${c.email}-${c.idx}`}
              className="inline-flex items-center gap-1.5 rounded-[20px] border-[1.5px] border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-gray-700"
            >
              <span className="text-[13px]">✉️</span>
              <span className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap">
                {c.display}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChipAt(c.idx);
                }}
                className="ml-0.5 cursor-pointer border-none bg-transparent p-0 text-[13px] leading-none text-gray-500 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="email"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              onSetShowDropdown(step.id, true);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => onSetShowDropdown(step.id, true)}
            onBlur={() =>
              setTimeout(() => onSetShowDropdown(step.id, false), 200)
            }
            placeholder={
              step.emails.length === 0
                ? "email@ejemplo.com  ·  busca usuario  ·  selecciona grupo…"
                : ""
            }
            className="min-w-[180px] flex-1 border-none bg-transparent text-[13px] text-gray-900 outline-none"
          />
        </div>

        {dropdownVisible && (
          <RecipientDropdown
            users={searchedUsers}
            groups={groups}
            onSelectUser={(u) => onAddUser(step.id, u)}
            onAddGroupMembers={(g) => onAddGroupMembers(step.id, g)}
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="text-gray-400">
          Enter o coma para agregar · pegá varios separados por coma/espacio
        </span>
        <ExcelEmailUploader
          existingEmails={step.emails}
          onAdd={(added) => {
            if (added.length === 0) return;
            onSetEmails(step.id, [...step.emails, ...added]);
          }}
          compact
        />
        {hint && <span className="font-semibold text-red-600">{hint}</span>}
      </div>

      {parallelCount > 1 && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[12px] text-emerald-800">
          🔁 Este paso se completará cuando <strong>todos</strong> los
          destinatarios ({parallelCount}) hayan diligenciado.
        </div>
      )}
    </div>
  );
}
