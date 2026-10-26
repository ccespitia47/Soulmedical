import { useEffect, useRef } from "react";
import { clearSession, getToken, refreshTokenApi, saveSession, getStoredUser } from "../services/api";

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 h sin actividad → logout
const REFRESH_LEAD_MS = 60 * 1000; // Refrescar 60s antes de expirar
const REFRESH_MIN_DELAY_MS = 5 * 1000; // Nunca refrescar tan seguido que sature el backend
const REFRESH_RETRY_MS = 30 * 1000; // Reintentar refresh a los 30s si falló y aún queda tiempo
const WINDOW_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
];

/**
 * Decodifica el `exp` (segundos epoch) de un JWT. Devuelve ms epoch o null.
 * No verifica firma — solo se usa para saber cuándo caduca este token
 * localmente y así programar el refresh un poco antes.
 */
function readJwtExpMs(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * Gestiona el ciclo de vida de la sesión mientras el usuario está logueado.
 *
 * 1. IDLE LOGOUT: si NO hay actividad durante IDLE_LIMIT_MS (1 h), cierra
 *    la sesión por seguridad. La actividad reinicia este timer.
 *
 * 2. REFRESH DINÁMICO DEL JWT: el token tiene un TTL absoluto (30 min desde
 *    emisión en el backend). En vez de un `setInterval` fijo, este hook lee
 *    el `exp` del JWT actual y programa un `setTimeout` que dispara REFRESH_LEAD_MS
 *    antes de que caduque. Cuando el refresh trae un token nuevo, se re-programa.
 *    Así es imposible que el token muera antes del refresh (bug anterior: con
 *    intervalo fijo de 15 min, si el usuario recargaba con un token de 20 min
 *    de vida ya usados, moría antes del siguiente tick).
 *
 * Solo se monta cuando hay usuario logueado (`enabled` true).
 */
export function useIdleLogout(enabled: boolean) {
  const idleTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        console.warn(
          "[idle] 30 minutos sin actividad. Cerrando sesión por seguridad.",
        );
        clearSession();
      }, IDLE_LIMIT_MS);
    };

    // Programa (o re-programa) el refresh del token en base al `exp` real
    // del JWT actual. Idempotente: cancela el timer previo si existía.
    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      const token = getToken();
      if (!token) return;
      const expMs = readJwtExpMs(token);
      if (!expMs) {
        // No pudimos leer el exp — degradación segura: refrescar en 10 min.
        refreshTimerRef.current = window.setTimeout(runRefresh, 10 * 60 * 1000);
        return;
      }
      const delay = Math.max(
        REFRESH_MIN_DELAY_MS,
        expMs - Date.now() - REFRESH_LEAD_MS,
      );
      refreshTimerRef.current = window.setTimeout(runRefresh, delay);
    };

    const runRefresh = async () => {
      refreshTimerRef.current = null;

      // Si el usuario está inactivo hace más de IDLE_LIMIT_MS, no gastamos
      // en renovar — el timer de idle lo va a cerrar de todos modos.
      const sinceLastActivity = Date.now() - lastActivityRef.current;
      if (sinceLastActivity > IDLE_LIMIT_MS) return;

      const { data, error } = await refreshTokenApi();
      if (error || !data) {
        console.warn(
          `[refresh] No se pudo renovar el token: ${error ?? "sin data"}. Reintento en ${REFRESH_RETRY_MS / 1000}s.`,
        );
        // Reintento corto: si el error fue transitorio (red, rate-limit), no
        // esperamos hasta la próxima expiración para intentar de nuevo.
        refreshTimerRef.current = window.setTimeout(runRefresh, REFRESH_RETRY_MS);
        return;
      }
      const currentUser = getStoredUser();
      saveSession(
        data.access_token,
        data.user ?? currentUser ?? { id: 0, name: "", email: "", role: "user" },
      );
      // Re-programar con el `exp` del token nuevo.
      scheduleRefresh();
    };

    const onVisibility = () => {
      if (!document.hidden) {
        markActivity();
        // Al volver a la pestaña, re-evaluamos el schedule por si el
        // timer sufrió throttling en background y el token está a punto
        // de caducar (o ya caducó).
        scheduleRefresh();
      }
    };

    markActivity();
    scheduleRefresh();

    for (const ev of WINDOW_ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      for (const ev of WINDOW_ACTIVITY_EVENTS) {
        window.removeEventListener(ev, markActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
