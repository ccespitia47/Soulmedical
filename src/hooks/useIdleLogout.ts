import { useEffect, useRef } from "react";
import { clearSession } from "../services/api";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
const WINDOW_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

/**
 * Cierra la sesión automáticamente si no hay actividad del usuario durante
 * IDLE_LIMIT_MS (30 min). "Actividad" se define como cualquier evento de
 * mouse/teclado/touch o el regreso de la pestaña al primer plano.
 *
 * El JWT también expira a 30 min en el backend, pero su expiración es
 * ABSOLUTA (desde que se emitió). Este hook implementa el ciclo IDLE: si
 * el usuario interactúa durante el periodo, el contador se reinicia.
 *
 * Solo se monta cuando hay usuario logueado (`enabled` true).
 */
export function useIdleLogout(enabled: boolean) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        console.warn(
          "[idle] 30 minutos sin actividad. Cerrando sesión por seguridad.",
        );
        clearSession();
      }, IDLE_LIMIT_MS);
    };

    const onVisibility = () => {
      if (!document.hidden) reset();
    };

    reset();
    for (const ev of WINDOW_ACTIVITY_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      for (const ev of WINDOW_ACTIVITY_EVENTS) {
        window.removeEventListener(ev, reset);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
