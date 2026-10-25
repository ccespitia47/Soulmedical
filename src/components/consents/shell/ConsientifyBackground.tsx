// Fondo animado de Consientify: virus, bacterias y jeringas flotando despacio
// detrás del contenido.
//
// Los parámetros son los del prototipo que el usuario aprobó entre tres
// intensidades — ver docs/superpowers/specs/assets/2026-10-24-fondo-animado-prototipo.html.
// No son decorativos: son lo que separa "se reconoce de fondo" de "estorba al
// leer un consentimiento", que es el anti-objetivo declarado de esta pantalla.

import { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  PALETA, ANCHO_MIN, ANCHO_MAX, CICLO_MIN, CICLO_MAX, DESFASE_MAX, OPACIDAD, TIPOS,
  VIAJE_MIN, VIAJE_MAX, numeroDeFormas, type Tipo,
} from "./fondoParams";

type Forma = {
  tipo: Tipo;
  color: string;
  ancho: number;
  izquierda: number;
  arriba: number;
  ciclo: number;
  desfase: number;
  /** Recorrido propio, para que no se desplacen todas en bloque. */
  viajeX: number;
  viajeY: number;
};

const entre = (min: number, max: number) => min + Math.random() * (max - min);

const signo = () => (Math.random() < 0.5 ? -1 : 1);

function sortearFormas(cuantas: number): Forma[] {
  return Array.from({ length: cuantas }, (_, i) => ({
    tipo: TIPOS[i % TIPOS.length],
    color: PALETA[i % PALETA.length],
    ancho: entre(ANCHO_MIN, ANCHO_MAX),
    izquierda: Math.random() * 92,
    arriba: Math.random() * 88,
    ciclo: entre(CICLO_MIN, CICLO_MAX),
    desfase: -Math.random() * DESFASE_MAX,
    viajeX: signo() * entre(VIAJE_MIN, VIAJE_MAX),
    viajeY: signo() * entre(VIAJE_MIN, VIAJE_MAX),
  }));
}

function Virus({ color }: { color: string }) {
  const espiculas = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    const [x1, y1] = [20 + Math.cos(a) * 11, 20 + Math.sin(a) * 11];
    const [x2, y2] = [20 + Math.cos(a) * 17, 20 + Math.sin(a) * 17];
    return (
      <g key={k}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.4} />
        <circle cx={x2} cy={y2} r={2.4} fill={color} />
      </g>
    );
  });
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={11} fill={color} />
      {espiculas}
    </svg>
  );
}

function Bacteria({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 24">
      <rect x={4} y={6} width={40} height={12} rx={6} fill={color} />
      <path d="M4 12 C -2 6, -2 18, 2 12" stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}

function Jeringa({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 16">
      <rect x={10} y={5} width={24} height={7} rx={2} fill={color} />
      <rect x={34} y={7} width={10} height={3} rx={1.5} fill={color} />
      <rect x={4} y={3} width={4} height={11} rx={1.5} fill={color} />
    </svg>
  );
}

const DIBUJO: Record<Tipo, (p: { color: string }) => React.JSX.Element> = {
  virus: Virus,
  bacteria: Bacteria,
  jeringa: Jeringa,
};

function prefiereMenosMovimiento(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ConsientifyBackground() {
  const { theme } = useTheme();
  // Se sortean una sola vez por montaje: resortear en cada render haría
  // saltar las formas de sitio.
  // La densidad se calcula sobre el área real de la ventana: 16 formas lucen
  // bien en un recuadro de muestra y desaparecen en una pantalla completa.
  const formas = useMemo(() => {
    const area = typeof window === "undefined" ? 1_700_000 : window.innerWidth * window.innerHeight;
    return sortearFormas(numeroDeFormas(area));
  }, []);
  const quieto = prefiereMenosMovimiento();

  // Sobre lienzo claro la paleta pierde contraste contra el texto gris, así que
  // se oscurece y se baja la opacidad; sobre oscuro va tal cual.
  const claro = theme === "light";

  return (
    <>
      <style>{`@keyframes consientify-flotar {
        0%   { transform: translate(0,0) rotate(0deg); }
        50%  { transform: translate(var(--viaje-x), var(--viaje-y)) rotate(180deg); }
        100% { transform: translate(0,0) rotate(360deg); }
      }`}</style>
      <div
        data-testid="fondo"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          filter: claro ? "saturate(0.85) brightness(0.75)" : undefined,
        }}
      >
        {formas.map((f, i) => {
          const Dibujo = DIBUJO[f.tipo];
          return (
            <div
              key={i}
              data-bicho={f.tipo}
              data-color={f.color}
              style={{
                position: "absolute",
                left: `${f.izquierda}%`,
                top: `${f.arriba}%`,
                width: `${f.ancho}px`,
                height: `${f.tipo === "virus" ? f.ancho : f.ancho * 0.5}px`,
                opacity: claro ? OPACIDAD * 0.65 : OPACIDAD,
                animationName: quieto ? "none" : "consientify-flotar",
                animationDuration: `${f.ciclo}s`,
                animationDelay: `${f.desfase}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                ["--viaje-x" as string]: `${f.viajeX}px`,
                ["--viaje-y" as string]: `${f.viajeY}px`,
              } as React.CSSProperties}
            >
              <Dibujo color={f.color} />
            </div>
          );
        })}
      </div>
    </>
  );
}
