export type RecipientSource = "user" | "group" | "external";

export type Recipient = {
  id: string;
  email: string;
  name: string;
  source: RecipientSource;
};

export type Step = {
  id: string;
  recipient: Recipient | null;
  inputEmail: string;
  inputName: string;
};

export type SimpleUser = { id: number; email: string; name: string };

export const TASK_INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 outline-none focus:border-[#00c2a8]";

export const TASK_LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-gray-500";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
