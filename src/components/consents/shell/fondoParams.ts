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
