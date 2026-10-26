import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  /**
   * "photo"  → fondo fotográfico oscuro (Register / Forgot / Reset).
   * "light"  → fondo claro degradado con temática médica sutil (Login).
   * Retrocompatible: por defecto se mantiene el fondo original.
   */
  variant?: "photo" | "light";
  /**
   * Imagen de fondo (ruta pública). Si se pasa, reemplaza el fondo decorativo
   * generado y usa la imagen a pantalla completa. Usado por el Login.
   */
  bgImage?: string;
};

const MAX_WIDTHS: Record<NonNullable<AuthLayoutProps["maxWidth"]>, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[480px]",
  lg: "max-w-[520px]",
};

/**
 * Fondo diseñado a partir del logo: los cuatro símbolos de Grupo Soul
 * (hexagrama/estrella, molécula/célula, engranaje+cruz y corazón en la
 * mano) dibujados como línea, en sus colores de marca y baja opacidad,
 * repartidos alrededor del contenido.
 */
function LogoBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 800"
      fill="none"
    >
      {/* ── Engranaje + bombilla + cruz (dorado) — arriba izquierda ── */}
      <g transform="translate(212 196)" stroke="#F3B01C" strokeLinecap="round" strokeLinejoin="round" opacity="0.22">
        {/* dientes del engranaje */}
        <path
          strokeWidth="5"
          d="M44 0 L54 0 M35.6 25.9 L43.7 31.8 M13.6 41.8 L16.7 51.4 M-13.6 41.8 L-16.7 51.4 M-35.6 25.9 L-43.7 31.8 M-44 0 L-54 0 M-35.6 -25.9 L-43.7 -31.8 M-13.6 -41.8 L-16.7 -51.4 M13.6 -41.8 L16.7 -51.4 M35.6 -25.9 L43.7 -31.8"
        />
        <circle r="42" strokeWidth="3" />
        {/* bombilla */}
        <circle cx="0" cy="-6" r="16" strokeWidth="3" />
        <path strokeWidth="3" d="M-8 9 L-7 13 M8 9 L7 13 M-7 13 L7 13 M-5 17 L5 17" />
        {/* cruz médica */}
        <path strokeWidth="3.5" d="M0 -14 L0 1 M-7 -7 L7 -7" />
      </g>

      {/* ── Hexagrama / estrella (verde oliva) — arriba derecha ── */}
      <g transform="translate(1000 190)" stroke="#8FAE3A" strokeWidth="4" strokeLinejoin="round" opacity="0.22">
        <path d="M0 -80 L-69.3 40 L69.3 40 Z" />
        <path d="M0 80 L-69.3 -40 L69.3 -40 Z" />
      </g>

      {/* ── Molécula / célula (teal) — abajo izquierda ── */}
      <g transform="translate(205 610)" stroke="#16A6C0" strokeWidth="3.5" strokeLinecap="round" opacity="0.22">
        <path d="M22 0 L38 0 M15.6 15.6 L26.9 26.9 M0 22 L0 38 M-15.6 15.6 L-26.9 26.9 M-22 0 L-38 0 M-15.6 -15.6 L-26.9 -26.9 M0 -22 L0 -38 M15.6 -15.6 L26.9 -26.9" />
        <circle r="22" />
        <circle cx="45" cy="0" r="6" />
        <circle cx="31.8" cy="31.8" r="6" />
        <circle cx="0" cy="45" r="6" />
        <circle cx="-31.8" cy="31.8" r="6" />
        <circle cx="-45" cy="0" r="6" />
        <circle cx="-31.8" cy="-31.8" r="6" />
        <circle cx="0" cy="-45" r="6" />
        <circle cx="31.8" cy="-31.8" r="6" />
        <circle cx="-7" cy="-5" r="2.8" fill="#16A6C0" stroke="none" />
        <circle cx="6" cy="-8" r="2.8" fill="#16A6C0" stroke="none" />
        <circle cx="1" cy="7" r="2.8" fill="#16A6C0" stroke="none" />
      </g>

      {/* ── Dos manos sosteniendo un corazón (magenta) — abajo derecha ── */}
      <g transform="translate(995 606)" stroke="#A62E8A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.22">
        {/* corazón */}
        <path d="M0 -4 C -6 -14 -20 -10 -20 1 C -20 11 -6 17 0 23 C 6 17 20 11 20 1 C 20 -10 6 -14 0 -4 Z" />
        {/* mano izquierda: dedos + palma */}
        <path d="M-18 -8 L-20 -27 M-26 -6 L-30 -25 M-34 -3 L-40 -20 M-40 3 L-48 -12" />
        <path d="M-46 7 C -46 21 -32 31 -14 25 C -8 23 -3 22 0 23" />
        {/* mano derecha (espejo) */}
        <path d="M18 -8 L20 -27 M26 -6 L30 -25 M34 -3 L40 -20 M40 3 L48 -12" />
        <path d="M46 7 C 46 21 32 31 14 25 C 8 23 3 22 0 23" />
      </g>

      {/* ── Repeticiones pequeñas para dar ritmo ── */}
      <g strokeWidth="3" strokeLinejoin="round" opacity="0.16">
        {/* mini hexagrama abajo centro (verde oliva) */}
        <g stroke="#8FAE3A">
          <path d="M620 664 L592.3 712 L647.7 712 Z" />
          <path d="M620 728 L592.3 680 L647.7 680 Z" />
        </g>
        {/* mini molécula arriba centro (teal) */}
        <g stroke="#16A6C0" strokeLinecap="round">
          <path d="M650 120 L650 100 M650 120 L672 120 M650 120 L634 136" />
          <circle cx="650" cy="120" r="12" />
          <circle cx="650" cy="96" r="4.5" />
          <circle cx="676" cy="120" r="4.5" />
          <circle cx="630" cy="140" r="4.5" />
        </g>
      </g>

      {/* ── Puntitos de acento en colores de marca ── */}
      <g opacity="0.3">
        <circle cx="430" cy="140" r="4" fill="#F3B01C" />
        <circle cx="800" cy="120" r="3.5" fill="#A62E8A" />
        <circle cx="360" cy="690" r="3.5" fill="#16A6C0" />
        <circle cx="880" cy="700" r="4" fill="#8FAE3A" />
        <circle cx="1080" cy="430" r="3.5" fill="#F3B01C" />
        <circle cx="120" cy="400" r="3.5" fill="#A62E8A" />
      </g>
    </svg>
  );
}

export default function AuthLayout({
  children,
  maxWidth = "sm",
  variant = "photo",
  bgImage,
}: AuthLayoutProps) {
  // Fondo por imagen (Login): la imagen ya trae la temática médica, así que
  // reemplaza el fondo decorativo generado.
  if (bgImage) {
    return (
      <div
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-cover bg-center px-4 font-sans"
        style={{ backgroundImage: `url('${bgImage}')` }}
      >
        <div className={`relative z-10 w-full ${MAX_WIDTHS[maxWidth]}`}>{children}</div>
      </div>
    );
  }

  if (variant === "light") {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#e8f5f6_0%,#f2fafb_40%,#fdfdfb_72%,#faf6fb_100%)] px-4 font-sans">
        {/* Malla de color en las 4 esquinas — los 4 colores del logo */}
        <div className="pointer-events-none absolute -left-40 -top-44 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(22,166,192,0.24),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(243,176,28,0.18),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -right-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(166,46,138,0.20),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-52 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(143,174,58,0.16),transparent_70%)] blur-3xl" />

        {/* Símbolos del logo repartidos alrededor del contenido */}
        <LogoBackdrop />

        {/* Halo blanco detrás del contenido para que destaque */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,255,255,0.85),transparent_70%)] blur-2xl" />

        <div className={`relative z-10 w-full ${MAX_WIDTHS[maxWidth]}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-center font-sans"
      style={{ backgroundImage: "url('/Imagen_Fondo.jpeg')" }}
    >
      <div className="absolute inset-0 bg-[rgba(8,40,80,0.18)] backdrop-blur-[1px]" />
      <div className={`relative z-10 mx-4 w-full ${MAX_WIDTHS[maxWidth]}`}>{children}</div>
    </div>
  );
}
