// Parámetros del fondo animado de Consientify.
//
// Nacen del prototipo que el usuario aprobó entre tres intensidades —
// docs/superpowers/specs/assets/2026-10-24-fondo-animado-prototipo.html, opción B.
//
// OJO con los números del prototipo: se midieron dentro de un recuadro de
// 360x260 px. Trasladados tal cual a una pantalla completa daban 1 forma por
// 107.000 px² (el prototipo tenía 1 por 5.800) y un desplazamiento de 0,59
// px/segundo. Es decir, técnicamente animado e imposible de percibir.
//
// Lo que se conserva del prototipo es su INTENCIÓN —"se reconocen, lentos y
// discretos"— y para eso la densidad se calcula sobre el área de la ventana y
// el recorrido se expresa en píxeles visibles, no en los del recuadro.

export const PALETA = ["#2dd4bf", "#38bdf8", "#a78bfa", "#34d399"];

/** Una forma por cada tanto de área de ventana, con tope por rendimiento. */
export const AREA_POR_FORMA = 42_000; // px²
export const MIN_FORMAS = 12;
export const MAX_FORMAS = 44;

export const ANCHO_MIN = 24;
export const ANCHO_MAX = 44;
export const CICLO_MIN = 20; // segundos
export const CICLO_MAX = 34;
export const DESFASE_MAX = 20; // segundos, aplicado en negativo
export const OPACIDAD = 0.42;

/** Recorrido de ida (la vuelta es simétrica), por forma. Da unos 5-9 px/s. */
export const VIAJE_MIN = 80;
export const VIAJE_MAX = 150;

export type Tipo = "virus" | "bacteria" | "jeringa";
export const TIPOS: Tipo[] = ["virus", "bacteria", "jeringa"];

/** Cuántas formas caben en un área dada, dentro de los topes. */
export function numeroDeFormas(areaPx2: number): number {
  const porArea = Math.round(areaPx2 / AREA_POR_FORMA);
  return Math.min(MAX_FORMAS, Math.max(MIN_FORMAS, porArea));
}

/** Clave de `localStorage` donde se recuerda si el fondo debe animarse. */
export const FONDO_STORAGE_KEY = "consientify-fondo-animado";

/** ¿Pide el sistema menos movimiento? */
export function sistemaPideQuietud(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Si el fondo debe animarse. Anima por DEFECTO: el fondo en movimiento es lo
 * que se pidió para esta pantalla, y `prefers-reduced-motion` lo vetaba sin
 * que nadie lo notara —Windows lo reporta `reduce` con Accesibilidad ›
 * Efectos visuales › Efectos de animación apagado, que viene así en muchos
 * equipos corporativos—. Quien quiera quietud la consigue con el interruptor
 * del riel, y esa elección sí se recuerda y manda sobre el defecto.
 */
export function fondoAnimadoPorDefecto(): boolean {
  try {
    const guardado = localStorage.getItem(FONDO_STORAGE_KEY);
    if (guardado === "1") return true;
    if (guardado === "0") return false;
  } catch {
    /* sin almacenamiento: vale el defecto */
  }
  return true;
}

export function recordarFondoAnimado(animado: boolean): void {
  try {
    localStorage.setItem(FONDO_STORAGE_KEY, animado ? "1" : "0");
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
}
