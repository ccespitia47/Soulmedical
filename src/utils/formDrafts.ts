/**
 * Borradores de formularios persistidos en localStorage por usuario.
 *
 * Solo cliente — no se sincronizan entre navegadores. Suficiente para
 * el caso "abrí, llené algunos campos, cerré por error y quiero volver".
 *
 * Llave: `formDraft:${userId}:${folderId}:${formId}`
 * Valor: { values, updatedAt, formName, folderId, formId }
 */

const PREFIX = "formDraft";
const INDEX_KEY = "formDraftIndex";

export type FormDraft = {
  userId: number | string;
  folderId: string;
  formId: string;
  formName: string;
  values: Record<string, string>;
  updatedAt: string;
};

function makeKey(userId: number | string, folderId: string, formId: string) {
  return `${PREFIX}:${userId}:${folderId}:${formId}`;
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(keys));
  } catch {
    // si no hay espacio o el storage está bloqueado, lo ignoramos.
  }
}

export function saveDraft(draft: FormDraft): void {
  // Si todos los valores están vacíos, no guardamos basura.
  const hasContent = Object.values(draft.values).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
  if (!hasContent) {
    deleteDraft(draft.userId, draft.folderId, draft.formId);
    return;
  }
  const key = makeKey(draft.userId, draft.folderId, draft.formId);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    const idx = readIndex();
    if (!idx.includes(key)) writeIndex([...idx, key]);
  } catch (err) {
    console.error("[formDrafts] No se pudo guardar borrador:", err);
  }
}

export function loadDraft(
  userId: number | string,
  folderId: string,
  formId: string,
): FormDraft | null {
  try {
    const raw = localStorage.getItem(makeKey(userId, folderId, formId));
    return raw ? (JSON.parse(raw) as FormDraft) : null;
  } catch {
    return null;
  }
}

export function deleteDraft(
  userId: number | string,
  folderId: string,
  formId: string,
): void {
  const key = makeKey(userId, folderId, formId);
  try {
    localStorage.removeItem(key);
    const idx = readIndex().filter((k) => k !== key);
    writeIndex(idx);
  } catch {
    // ignore
  }
}

export function listDrafts(userId: number | string): FormDraft[] {
  const userPrefix = `${PREFIX}:${userId}:`;
  const result: FormDraft[] = [];
  for (const key of readIndex()) {
    if (!key.startsWith(userPrefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      result.push(JSON.parse(raw) as FormDraft);
    } catch {
      // ignore corrupted entries
    }
  }
  // Más recientes primero
  return result.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}
