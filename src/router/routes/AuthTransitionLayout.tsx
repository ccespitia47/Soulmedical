import { useEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

// Easing del preview: cubic-bezier(.22, 1, .36, 1).
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Rango de cada pantalla dentro del flujo de auth. Avanzar (rango mayor)
// empuja la transición hacia un lado; retroceder, hacia el contrario.
const RANK: Record<string, number> = {
  "/login": 0,
  "/register": 1,
  "/forgot-password": 1,
  "/reset-password": 2,
};

// `dir` = +1 avanzamos en el flujo, -1 retrocedemos. La hoja entrante llega
// desde un lado con rotateY/translateX y la saliente se va hacia el opuesto.
const variants: Variants = {
  enter: (dir: number) => ({
    x: `${dir * 55}%`,
    rotateY: dir * -24,
    scale: 0.9,
    opacity: 0,
  }),
  center: { x: "0%", rotateY: 0, scale: 1, opacity: 1 },
  exit: (dir: number) => ({
    x: `${dir * -55}%`,
    rotateY: dir * 24,
    scale: 0.9,
    opacity: 0,
  }),
};

// prefers-reduced-motion → solo un fundido rápido, sin 3D.
const reducedVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Layout compartido para las rutas de auth (/login, /register,
 * /forgot-password, /reset-password). Envuelve el <Outlet/> en una transición
 * 3D con profundidad al navegar entre pantallas, sin tocar las páginas por
 * dentro. La dirección depende de si avanzamos o retrocedemos en el flujo.
 */
export default function AuthTransitionLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();

  // Rango de la ruta previa (commit anterior) para calcular la dirección.
  const prevRank = useRef(RANK[location.pathname] ?? 0);
  const direction =
    (RANK[location.pathname] ?? 0) >= prevRank.current ? 1 : -1;
  useEffect(() => {
    prevRank.current = RANK[location.pathname] ?? 0;
  }, [location.pathname]);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ perspective: reduce ? undefined : 1400 }}
    >
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={reduce ? reducedVariants : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            reduce
              ? { duration: 0.2, ease: "easeOut" }
              : { duration: 0.6, ease: EASE }
          }
          className="absolute inset-0 overflow-y-auto"
          style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
