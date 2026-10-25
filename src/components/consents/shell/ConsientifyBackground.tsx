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
  PALETA, ANCHO_MIN, ANCHO_MAX, CICLO_MIN, CICLO_MAX, DESFASE_MAX, OPACIDAD, TIPOS, RATIO,
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

// Los tres dibujos son de CONTORNO, no de relleno. Una silueta maciza a este
// tamaño se lee como una mancha —la bacteria rellena pasaba por frasco— y es
// el perfil lo único que sobrevive a 0,42 de opacidad. Cada uno lleva además
// el rasgo que lo delata: espículas, flagelos, aguja y émbolo.

function Virus({ color }: { color: string }) {
  const espiculas = Array.from({ length: 10 }, (_, k) => {
    const a = (k * Math.PI) / 5;
    const [x1, y1] = [22 + Math.cos(a) * 11, 22 + Math.sin(a) * 11];
    const [x2, y2] = [22 + Math.cos(a) * 17.5, 22 + Math.sin(a) * 17.5];
    return (
      <g key={k}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={x2} cy={y2} r={2.8} fill={color} />
      </g>
    );
  });
  return (
    <svg width="100%" height="100%" viewBox="0 0 44 44">
      <circle cx={22} cy={22} r={11.5} fill="none" stroke={color} strokeWidth={2.8} />
      <circle cx={18.5} cy={20} r={2.1} fill={color} />
      <circle cx={25.2} cy={24.6} r={2.5} fill={color} />
      {espiculas}
    </svg>
  );
}

// Pilis cortos y rectos alrededor del bacilo, no flagelos largos: comparados
// uno al lado del otro a 34, 48 y 62 px, los flagelos se desdibujaban en
// pequeño y dos por lado formaban una V que leía como un moño. Los pilis
// aguantan el tamaño mínimo y dan la silueta erizada que se reconoce.
function Bacteria({ color }: { color: string }) {
  const pilis: [number, number, number, number][] = [
    [16, 7, 16, 3], [22, 7, 22, 2.6], [28, 7, 28, 3], [32, 8.5, 35, 5],
    [16, 19, 16, 23], [22, 19, 22, 23.4], [28, 19, 28, 23], [32, 17.5, 35, 21],
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 26">
      <rect x={11} y={7} width={26} height={12} rx={6} fill="none" stroke={color} strokeWidth={2.6} />
      <circle cx={18} cy={13} r={2} fill={color} />
      <circle cx={28} cy={13} r={2} fill={color} />
      {pilis.map(([x1, y1, x2, y2], k) => (
        <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ))}
      <path d="M37 13 C 41 10, 44 17, 47 13" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Jeringa({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 48 18">
      <line x1={0.8} y1={9} x2={7} y2={9} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M7 6.4 L7 11.6 L11.5 9 Z" fill={color} />
      <rect x={11.5} y={4} width={21} height={10} rx={1.5} fill="none" stroke={color} strokeWidth={2.2} />
      <rect x={13.2} y={5.8} width={8.4} height={6.4} rx={0.8} fill={color} />
      <line x1={25} y1={4} x2={25} y2={7} stroke={color} strokeWidth={1.3} />
      <line x1={28.5} y1={4} x2={28.5} y2={7} stroke={color} strokeWidth={1.3} />
      <line x1={32.5} y1={9} x2={42.6} y2={9} stroke={color} strokeWidth={2.3} strokeLinecap="round" />
      <line x1={32.5} y1={2.2} x2={32.5} y2={15.8} stroke={color} strokeWidth={2.3} strokeLinecap="round" />
      <line x1={42.6} y1={3.6} x2={42.6} y2={14.4} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

const DIBUJO: Record<Tipo, (p: { color: string }) => React.JSX.Element> = {
  virus: Virus,
  bacteria: Bacteria,
  jeringa: Jeringa,
};

type Props = {
  /** Lo decide el marco: el ajuste del sistema manda por defecto y el
   *  interruptor del riel lo puede sobrescribir (ver `fondoAnimadoPorDefecto`). */
  animado?: boolean;
};

export default function ConsientifyBackground({ animado = true }: Props) {
  const { theme } = useTheme();
  // Se sortean una sola vez por montaje: resortear en cada render haría
  // saltar las formas de sitio.
  // La densidad se calcula sobre el área real de la ventana: 16 formas lucen
  // bien en un recuadro de muestra y desaparecen en una pantalla completa.
  const formas = useMemo(() => {
    const area = typeof window === "undefined" ? 1_700_000 : window.innerWidth * window.innerHeight;
    return sortearFormas(numeroDeFormas(area));
  }, []);
  const quieto = !animado;

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
                height: `${f.ancho * RATIO[f.tipo]}px`,
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
