import { useCallback, useState } from "react";

const LS_PINNED = "sf_pinned_projects";
const LS_RECENTS = "sf_recent_forms";
const LS_FAVORITES = "sf_favorite_forms";

export type RecentEntry = {
  formId: string;
  folderId: string;
  formName: string;
  folderName: string;
  ts: number;
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* noop */
  }
}

export function useHomePersistence() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => lsGet(LS_PINNED, [] as string[]));
  const [recents, setRecents] = useState<RecentEntry[]>(() => lsGet(LS_RECENTS, [] as RecentEntry[]));
  const [favorites, setFavorites] = useState<string[]>(() => lsGet(LS_FAVORITES, [] as string[]));

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      lsSet(LS_PINNED, next);
      return next;
    });
  }, []);

  const addRecent = useCallback((entry: Omit<RecentEntry, "ts">) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.formId !== entry.formId);
      const next = [{ ...entry, ts: Date.now() }, ...filtered].slice(0, 20);
      lsSet(LS_RECENTS, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((formId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(formId) ? prev.filter((x) => x !== formId) : [...prev, formId];
      lsSet(LS_FAVORITES, next);
      return next;
    });
  }, []);

  return { pinnedIds, togglePin, recents, addRecent, favorites, toggleFavorite };
}
