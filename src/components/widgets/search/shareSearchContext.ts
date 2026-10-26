import { createContext } from "react";

/**
 * Contexto activo solo dentro de la página pública de enlace compartible
 * (`/tasks/share/:token` → TaskSharePage). Cuando está presente, los widgets
 * de búsqueda que dependen de endpoints autenticados (form_submissions) deben
 * llamar al endpoint público `POST /api/tasks/share/:token/search` en lugar del
 * autenticado, porque el visitante del enlace no tiene sesión.
 */
export type ShareSearchCtx = { token: string } | null;

export const ShareSearchContext = createContext<ShareSearchCtx>(null);
