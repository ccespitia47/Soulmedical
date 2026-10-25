// Parámetros del fondo animado de Consientify.
//
// Son los del prototipo que el usuario aprobó entre tres intensidades —
// docs/superpowers/specs/assets/2026-10-24-fondo-animado-prototipo.html.
// No son decorativos: separan "se reconoce de fondo" de "estorba al leer un
// consentimiento", que es el anti-objetivo declarado de esta pantalla.
//
// Viven aparte del componente porque `react-refresh/only-export-components`
// no admite exportar constantes desde un fichero de componente.

export const PALETA = ["#2dd4bf", "#38bdf8", "#a78bfa", "#34d399"];
export const N_FORMAS = 16;

export const ANCHO_MIN = 18;
export const ANCHO_MAX = 30;
export const CICLO_MIN = 20; // segundos
export const CICLO_MAX = 34;
export const DESFASE_MAX = 20; // segundos, aplicado en negativo
export const OPACIDAD = 0.42;

export type Tipo = "virus" | "bacteria" | "jeringa";
export const TIPOS: Tipo[] = ["virus", "bacteria", "jeringa"];
