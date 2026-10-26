export type RecipientSource = "user" | "group" | "external";

export type Recipient = {
  id: string;
  email: string;
  name: string;
  source: RecipientSource;
};

/**
 * Un paso puede tener N correos en paralelo. El primero es el "principal"
 * (recipientEmail en el DTO) y todos son enviados juntos como respondents.
 * `namesByEmail` guarda el nombre asociado a los emails que se agregaron
 * seleccionando un usuario del dropdown — los emails tipeados o subidos
 * por Excel no tienen nombre y usan el email como fallback.
 */
export type Step = {
  id: string;
  emails: string[];
  namesByEmail: Record<string, string>;
};

export type SimpleUser = { id: number; email: string; name: string };

export const TASK_INPUT_CLASS =
  "box-border w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 outline-none transition focus:border-[#00c2a8] focus:ring-2 focus:ring-[#00c2a8]/15";

export const TASK_LABEL_CLASS =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
