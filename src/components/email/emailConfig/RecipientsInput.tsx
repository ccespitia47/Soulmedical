import { useRef, useState } from "react";
import type { EmailRecipient } from "../../../types/email-template.types";
import { ROLE_LABELS } from "../../../types/auth.types";
import { randomUUID } from "../../../utils/uuid";

export type RecipientUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

export const AVAILABLE_GROUPS = [
  { id: "current_user", label: "Quien diligencia", icon: "✍️", color: "#00c2a8" },
  { id: "me", label: "Yo (usuario actual)", icon: "🙋", color: "#10b981" },
  { id: "admin", label: "Administradores", icon: "👨‍💼", color: "#7c3aed" },
  { id: "coordinator", label: "Coordinadores", icon: "👩‍⚕️", color: "#0891b2" },
  { id: "user", label: "Todos los usuarios", icon: "👤", color: "#d97706" },
];

type RecipientsInputProps = {
  label: string;
  recipients: EmailRecipient[];
  allUsers: RecipientUser[];
  hasError?: boolean;
  onChange: (r: EmailRecipient[]) => void;
};

function tagMeta(r: EmailRecipient) {
  if (r.type === "group") {
    const g = AVAILABLE_GROUPS.find((x) => x.id === r.group);
    return {
      color: g?.color ?? "#6b7280",
      bg: `${g?.color ?? "#6b7280"}18`,
      icon: g?.icon ?? "👥",
      label: r.groupLabel ?? r.group ?? "",
    };
  }
  return { color: "#374151", bg: "#f3f4f6", icon: "✉️", label: r.email ?? "" };
}

function groupDescription(id: string, label: string) {
  if (id === "current_user") return "Email del campo del formulario";
  if (id === "me") return "Email del usuario logueado en la plataforma";
  return `Todos los ${label.toLowerCase()}`;
}

export default function RecipientsInput({
  label,
  recipients,
  allUsers,
  hasError,
  onChange,
}: RecipientsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = inputValue.trim().toLowerCase();
  const alreadyGroupIds = recipients.filter((r) => r.type === "group").map((r) => r.group);
  const alreadyEmails = recipients.filter((r) => r.type === "static").map((r) => r.email);

  const groupSuggestions = AVAILABLE_GROUPS.filter(
    (g) =>
      !alreadyGroupIds.includes(g.id) &&
      (query === "" || g.label.toLowerCase().includes(query))
  );
  const userSuggestions = allUsers.filter(
    (u) =>
      u.active &&
      !alreadyEmails.includes(u.email) &&
      query.length >= 2 &&
      (u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query))
  );
  const hasDropdown =
    showDropdown && (groupSuggestions.length > 0 || userSuggestions.length > 0);

  const addGroup = (group: (typeof AVAILABLE_GROUPS)[0]) => {
    onChange([
      ...recipients,
      { id: randomUUID(), type: "group", group: group.id, groupLabel: group.label },
    ]);
    setInputValue("");
    inputRef.current?.focus();
  };

  const addStatic = (email: string) => {
    if (!email.includes("@")) return;
    onChange([...recipients, { id: randomUUID(), type: "static", email }]);
    setInputValue("");
    inputRef.current?.focus();
  };

  const remove = (id: string) => onChange(recipients.filter((r) => r.id !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      addStatic(inputValue.trim().replace(/,$/, ""));
    }
    if (e.key === "Backspace" && inputValue === "" && recipients.length > 0)
      remove(recipients[recipients.length - 1].id);
  };

  return (
    <div className="mb-4">
      <label
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.4px]"
        style={{ color: hasError ? "#dc2626" : "#6b7280" }}
      >
        {label}
        {hasError && <span className="text-red-600"> — Requerido</span>}
      </label>
      <div
        className="relative flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-1.5"
        style={{
          borderColor: hasError ? "#fca5a5" : "#e2e8f0",
          background: hasError ? "#fef2f2" : "#fff",
        }}
        onClick={() => {
          inputRef.current?.focus();
          setShowDropdown(true);
        }}
      >
        {recipients.map((r) => {
          const m = tagMeta(r);
          return (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-[20px] border-[1.5px] px-2 py-0.5 text-xs font-semibold"
              style={{ background: m.bg, borderColor: `${m.color}33`, color: m.color }}
            >
              <span className="text-[13px]">{m.icon}</span>
              <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                {m.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(r.id);
                }}
                className="ml-0.5 cursor-pointer border-none bg-transparent p-0 text-[13px] leading-none"
                style={{ color: m.color }}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={
            recipients.length === 0
              ? "Escribe un correo, busca usuario o selecciona un grupo..."
              : ""
          }
          className="min-w-[180px] flex-1 border-none bg-transparent text-[13px] text-gray-900 outline-none"
        />

        {hasDropdown && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[280px] overflow-y-auto rounded-[10px] border-[1.5px] border-slate-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            {groupSuggestions.length > 0 && (
              <>
                <div className="px-3.5 pb-1 pt-2 text-[10px] font-bold uppercase text-gray-400">
                  GRUPOS
                </div>
                {groupSuggestions.map((g) => (
                  <div
                    key={g.id}
                    onMouseDown={() => addGroup(g)}
                    className="flex cursor-pointer items-center gap-2.5 border-l-[3px] px-3.5 py-2 hover:bg-slate-50"
                    style={{ borderLeftColor: g.color }}
                  >
                    <span className="text-lg">{g.icon}</span>
                    <div>
                      <div className="text-[13px] font-semibold">{g.label}</div>
                      <div className="text-[11px] text-gray-400">
                        {groupDescription(g.id, g.label)}
                      </div>
                    </div>
                    <span
                      className="ml-auto rounded-[20px] px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: `${g.color}18`, color: g.color }}
                    >
                      GRUPO
                    </span>
                  </div>
                ))}
              </>
            )}
            {userSuggestions.length > 0 && (
              <>
                <div
                  className="px-3.5 pb-1 pt-2 text-[10px] font-bold uppercase text-gray-400"
                  style={{
                    borderTop:
                      groupSuggestions.length > 0 ? "1px solid #f1f5f9" : "none",
                  }}
                >
                  USUARIOS
                </div>
                {userSuggestions.map((u) => (
                  <div
                    key={u.id}
                    onMouseDown={() => addStatic(u.email)}
                    className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50"
                  >
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-[#00c2a8] to-[#0891b2] text-[13px] font-bold text-white">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold">{u.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {u.email} ·{" "}
                        {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {query.includes("@") && !alreadyEmails.includes(query) && (
              <div
                onMouseDown={() => addStatic(query)}
                className="flex cursor-pointer items-center gap-2.5 border-t border-slate-100 px-3.5 py-2 hover:bg-slate-50"
              >
                <span className="text-lg">✉️</span>
                <div>
                  <div className="text-[13px] font-semibold">
                    Agregar "{query}"
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Destinatario estático
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 text-[11px] text-gray-400">
        Escribe un correo y presiona Enter · Busca usuarios por nombre · Selecciona grupos del
        menú
      </div>
    </div>
  );
}
