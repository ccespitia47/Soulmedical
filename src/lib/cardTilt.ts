import type { MouseEvent } from "react";

// Inclinación máxima (grados) del tilt 3D que sigue al cursor.
const MAX_TILT = 16;

/**
 * Tilt 3D "gamer" pero sutil sobre una tarjeta: inclina en rotateX/rotateY
 * según la posición del cursor, la eleva ligeramente y coloca un brillo radial
 * (variables --mx/--my) más una sombra del color de la app. Pensado para
 * usarse en onMouseMove sobre un elemento con transición de transform.
 */
export function tiltMove(e: MouseEvent<HTMLElement>, glow: string) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  const rx = (0.5 - py) * MAX_TILT;
  const ry = (px - 0.5) * MAX_TILT;
  el.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-8px) scale(1.03)`;
  el.style.setProperty("--mx", `${px * 100}%`);
  el.style.setProperty("--my", `${py * 100}%`);
  el.style.boxShadow = `0 34px 64px -14px ${glow}`;
}

/** Devuelve la tarjeta a su estado normal al salir el cursor. */
export function tiltReset(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.transform = "";
  el.style.boxShadow = "";
}
